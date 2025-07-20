import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

// helper to safely parse numeric fields
function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

async function ensureTablesExist() {
  try {
    // Heartland PO imports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heartland_po_imports (
        id SERIAL PRIMARY KEY,
        po_number TEXT,
        po_description TEXT,
        po_start_ship DATE,
        po_end_ship DATE,
        po_vendor TEXT,
        po_received_at_location TEXT,
        item_description TEXT,
        item_default_cost NUMERIC,
        item_current_price NUMERIC,
        item_active BOOLEAN,
        item_track_inventory BOOLEAN,
        item_primary_vendor TEXT,
        item_taxable BOOLEAN,
        item_department TEXT,
        item_category TEXT,
        item_series TEXT,
        item_number TEXT,
        po_line_unit_cost NUMERIC,
        po_line_qty INTEGER,
        item_bricklink_id TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ToyHouse master data table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toyhouse_master_data (
        id SERIAL PRIMARY KEY,
        brand TEXT,
        item_number TEXT,
        description TEXT,
        bricklink_id TEXT,
        department TEXT,
        sub_department TEXT,
        bam_category TEXT,
        theme TEXT,
        long_description TEXT,
        primary_vendor TEXT,
        sell_on_shopify BOOLEAN,
        shopify_tags TEXT,
        active BOOLEAN,
        msrp NUMERIC,
        default_cost NUMERIC,
        current_price NUMERIC,
        taxable BOOLEAN,
        upc TEXT,
        height NUMERIC,
        width NUMERIC,
        depth NUMERIC,
        weight NUMERIC,
        weight_in_oz NUMERIC,
        image_1 TEXT,
        image_2 TEXT,
        image_3 TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ All tables ensured');
  } catch (err) {
    console.error('❌ Error ensuring tables:', err);
  }
}

ensureTablesExist();

app.use(express.static(path.resolve(__dirname, '../public')));

// Upload Heartland PO CSV
app.post(
  '/api/upload-po-csv',
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const results: any[] = [];

    fs.createReadStream(req.file.path)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number'),
        })
      )
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          await pool.query('DELETE FROM heartland_po_imports');

          for (const row of results) {
            await pool.query(
              `
              INSERT INTO heartland_po_imports
                (po_number, po_description, po_start_ship, po_end_ship,
                 po_vendor, po_received_at_location, item_description,
                 item_default_cost, item_current_price, item_active,
                 item_track_inventory, item_primary_vendor, item_taxable,
                 item_department, item_category, item_series, item_number,
                 po_line_unit_cost, po_line_qty, item_bricklink_id)
              VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
            `,
              [
                row.po_number,
                row.po_description,
                row.po_start_ship,
                row.po_end_ship,
                row.po_vendor,
                row.po_received_at_location,
                row.item_description,
                parseNumber(row.item_default_cost),
                parseNumber(row.item_current_price),
                row.item_active === 'yes',
                row.item_track_inventory === 'yes',
                row.item_primary_vendor,
                row.item_taxable === 'yes',
                row.item_department,
                row.item_category,
                row.item_series,
                row.item_number,
                parseNumber(row.po_line_unit_cost),
                parseInt(row.po_line_qty, 10) || 0,
                row.item_bricklink_id,
              ]
            );
          }

          if (req.file?.path) fs.unlinkSync(req.file.path);
          res.send('CSV data saved to database.');
        } catch (err) {
          console.error('❌ DB Insert Error:', err);
          res.status(500).send('Error saving CSV data to DB.');
        }
      });
  }
);

// Fetch all PO import items
app.get('/api/import-items', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM heartland_po_imports ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching items:', err);
    res.status(500).send('Error fetching import items');
  }
});

// Upload ToyHouse master data CSV
app.post(
  '/api/upload-toyhouse-csv',
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const results: any[] = [];

    fs.createReadStream(req.file.path)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number'),
        })
      )
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        // clear out old master data
        await pool.query('DELETE FROM toyhouse_master_data');
        let successCount = 0;

        for (const [i, row] of results.entries()) {
          try {
            await pool.query(
              `
              INSERT INTO toyhouse_master_data
                (brand, item_number, description, bricklink_id,
                 department, sub_department, bam_category, theme,
                 long_description, primary_vendor, sell_on_shopify,
                 shopify_tags, active, msrp, default_cost,
                 current_price, taxable, upc, height, width,
                 depth, weight, weight_in_oz, image_1, image_2, image_3)
              VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 $21,$22,$23,$24,$25,$26)
              `,
              [
                row.brand,
                row.item_number,
                row.description,
                row.bricklink_id,
                row.department,
                row.sub_department,
                row.bam_category,
                row.theme,
                row.long_description,
                row.primary_vendor,
                row.sell_on_shopify === 'Yes',
                row.shopify_tags,
                row.active === 'TRUE',
                parseNumber(row.msrp),
                parseNumber(row.default_cost),
                parseNumber(row.current_price),
                row.taxable === 'Yes',
                row.upc,
                parseNumber(row.height),
                parseNumber(row.width),
                parseNumber(row.depth),
                parseNumber(row.weight),
                parseNumber(row.weight_in_oz),
                row.image_1,
                row.image_2,
                row.image_3,
              ]
            );
            successCount++;
          } catch (e) {
            console.error(`⚠️ Skipped ToyHouse row ${i + 1}:`, e);
          }
        }

        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.send(
          `Imported ${successCount} of ${results.length} ToyHouse master records.`
        );
      });
  }
);

// SPA fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
