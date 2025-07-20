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
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// 🆕 Auto-create table if missing
async function ensureTableExists() {
  try {
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
    console.log("✅ Table heartland_po_imports ensured");
  } catch (err) {
    console.error("❌ Error ensuring table:", err);
  }
}

ensureTableExists();

// 🆕 Fixed public path for prod (../public)
app.use(express.static(path.resolve(__dirname, '../public')));

app.post('/api/upload-po-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const results: any[] = [];

  fs.createReadStream(req.file.path)
    .pipe(csv({
      // 🆕 Normalize headers: trim, lowercase, replace spaces/# with _
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number')
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          await pool.query(
            "INSERT INTO heartland_po_imports (po_number, po_description, po_start_ship, po_end_ship, po_vendor, po_received_at_location, item_description, item_default_cost, item_current_price, item_active, item_track_inventory, item_primary_vendor, item_taxable, item_department, item_category, item_series, item_number, po_line_unit_cost, po_line_qty, item_bricklink_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",
            [
              row.po_number,
              row.po_description,
              row.po_start_ship,
              row.po_end_ship,
              row.po_vendor,
              row.po_received_at_location,
              row.item_description,
              row.item_default_cost,
              row.item_current_price,
              row.item_active === 'yes',
              row.item_track_inventory === 'yes',
              row.item_primary_vendor,
              row.item_taxable === 'yes',
              row.item_department,
              row.item_category,
              row.item_series,
              row.item_number,
              row.po_line_unit_cost,
              row.po_line_qty,
              row.item_bricklink_id
            ]
          );
        }
        if (req.file?.path) fs.unlinkSync(req.file.path); // Clean up
        res.send('CSV data saved to database.');
      } catch (err) {
        console.error("❌ DB Insert Error:", err);
        res.status(500).send('Error saving CSV data to DB.');
      }
    });
});

// 🆕 Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
