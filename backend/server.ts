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

// 🆕 Auto-create table if it doesn't exist
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

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/upload-po-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const results: any[] = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          await pool.query(
            "INSERT INTO heartland_po_imports (po_number, po_description, po_start_ship, po_end_ship, po_vendor, po_received_at_location, item_description, item_default_cost, item_current_price, item_active, item_track_inventory, item_primary_vendor, item_taxable, item_department, item_category, item_series, item_number, po_line_unit_cost, po_line_qty, item_bricklink_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",
            [row['PO #'], row['PO Description'], row['PO Start Ship'], row['PO End Ship'], row['PO Vendor'], row['PO Received at location'], row['Item Description'], row['Item Default Cost'], row['Item Current Price'], row['Item Active?'] === 'yes', row['Item Track Inventory?'] === 'yes', row['Item Primary Vendor'], row['Item Taxable'] === 'yes', row['Item Department'], row['Item Category'], row['Item Series'], row['Item #'], row['PO Line Unit Cost'], row['PO Line Qty'], row['Item bricklink_id']]
          );
        }
        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.send('CSV data saved to database.');
      } catch (err) {
        console.error(err);
        res.status(500).send('Error saving CSV data to DB.');
      }
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
