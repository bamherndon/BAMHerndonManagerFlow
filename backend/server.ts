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
  ssl: process.env.NODE_ENV === 'production'
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
    // Heartland PO imports
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

    // ToyHouse master data
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

    // Sets images
    await pool.query(`
      CREATE TABLE IF NOT EXISTS set_image_urls (
        id SERIAL PRIMARY KEY,
        bricklink_id TEXT,
        rebrickable_image_url TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ All tables ensured');
  } catch (err) {
    console.error('❌ Error ensuring tables:', err);
  }
}

ensureTablesExist();

// Serve React
app.use(express.static(path.resolve(__dirname, '../public')));

// 1️⃣ Heartland PO upload
app.post('/api/upload-po-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const results: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number')
    }))
    .on('data', data => results.push(data))
    .on('end', async () => {
      try {
       
        for (const row of results) {
          await pool.query(
            `INSERT INTO heartland_po_imports
              (po_number, po_description, po_start_ship, po_end_ship,
               po_vendor, po_received_at_location, item_description,
               item_default_cost, item_current_price, item_active,
               item_track_inventory, item_primary_vendor, item_taxable,
               item_department, item_category, item_series, item_number,
               po_line_unit_cost, po_line_qty, item_bricklink_id)
             VALUES
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
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
              row.item_bricklink_id
            ]
          );
        }
        fs.unlinkSync(filePath);
        res.send('CSV data saved to database.');
      } catch (err) {
        console.error('❌ DB Insert Error:', err);
        res.status(500).send('Error saving CSV data to DB.');
      }
    });
});

app.get('/api/po-numbers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT po_number FROM heartland_po_imports ORDER BY po_number'
    );
    // return array of strings
    res.json(result.rows.map((r) => r.po_number));
  } catch (err) {
    console.error('❌ Error fetching PO numbers:', err);
    res.status(500).send('Error fetching PO numbers');
  }
});

// 2️⃣ Fetch PO items
app.get('/api/import-items', async (req, res) => {
  const po = req.query.po as string | undefined;
  try {
    let query = `
      SELECT
        h.*,
        COALESCE(s.rebrickable_image_url, t.image_1) AS image_url
      FROM heartland_po_imports h
      LEFT JOIN set_image_urls s
        ON h.item_bricklink_id = s.bricklink_id
      LEFT JOIN toyhouse_master_data t
        ON h.item_bricklink_id = t.bricklink_id
    `;
    const params: any[] = [];
    if (po) {
      params.push(po);
      query += ` WHERE h.po_number = $1`;
    }
    query += ` ORDER BY h.id`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching items with images:', err);
    res.status(500).send('Error fetching import items');
  }
});


// 3️⃣ ToyHouse master CSV
app.post('/api/upload-toyhouse-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const rows: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g,'_').replace(/#/g,'number')
    }))
    .on('data', data => rows.push(data))
    .on('end', async () => {
      await pool.query('DELETE FROM toyhouse_master_data');
      let success = 0;
      for (const [i, row] of rows.entries()) {
        try {
          await pool.query(
            `INSERT INTO toyhouse_master_data
              (brand, item_number, description, bricklink_id,
               department, sub_department, bam_category, theme,
               long_description, primary_vendor, sell_on_shopify,
               shopify_tags, active, msrp, default_cost,
               current_price, taxable, upc, height, width,
               depth, weight, weight_in_oz, image_1, image_2, image_3)
             VALUES
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26)`,
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
              row.image_3
            ]
          );
          success++;
        } catch (e) {
          console.error(`⚠️ Skipped ToyHouse row ${i+1}:`, e);
        }
      }
      fs.unlinkSync(filePath);
      res.send(`Imported ${success} of ${rows.length} ToyHouse master records.`);
    });
});

// 4️⃣ Sets images CSV
app.post('/api/upload-sets-images', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const filePath = req.file.path;
  const rows: any[] = [];

  fs.createReadStream(filePath)
    .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/ /g,'_') }))
    .on('data', data => rows.push(data))
    .on('end', async () => {
      await pool.query('DELETE FROM set_image_urls');
      let count = 0;
      for (const [i, row] of rows.entries()) {
        try {
          await pool.query(
            `INSERT INTO set_image_urls (bricklink_id, rebrickable_image_url)
             VALUES ($1,$2)`,
            [row.bricklink_id, row.rebrickable_image_url]
          );
          count++;
        } catch (e) {
          console.error(`⚠️ Skipped Sets row ${i+1}:`, e);
        }
      }
      fs.unlinkSync(filePath);
      res.send(`Imported ${count} of ${rows.length} set-image records.`);
    });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
