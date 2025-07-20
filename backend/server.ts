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

async function ensureTableExists() {
  try {
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
        launch DATE,
        retirement_date DATE,
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
    console.log("✅ Table toyhouse_master_data ensured");
  } catch (err) {
    console.error("❌ Error ensuring table:", err);
  }
}

ensureTableExists();

app.use(express.static(path.resolve(__dirname, '../public')));

app.post('/api/upload-toyhouse-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const results: any[] = [];

  fs.createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        header.trim().toLowerCase().replace(/ /g, '_').replace(/#/g, 'number')
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        await pool.query('DELETE FROM toyhouse_master_data');

        for (const row of results) {
          await pool.query(`
            INSERT INTO toyhouse_master_data
            (brand, item_number, description, bricklink_id, department, sub_department, bam_category, theme, long_description, primary_vendor, launch, retirement_date, sell_on_shopify, shopify_tags, active, msrp, default_cost, current_price, taxable, upc, height, width, depth, weight, weight_in_oz, image_1, image_2, image_3)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
          `, [
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
            row.launch ? new Date(row.launch) : null,
            row.retirement_date ? new Date(row.retirement_date) : null,
            row.sell_on_shopify === 'Yes',
            row.shopify_tags,
            row.active === 'TRUE',
            parseFloat(row.msrp?.replace('$', '') || '0'),
            parseFloat(row.default_cost?.replace('$', '') || '0'),
            parseFloat(row.current_price?.replace('$', '') || '0'),
            row.taxable === 'Yes',
            row.upc,
            parseFloat(row.height || '0'),
            parseFloat(row.width || '0'),
            parseFloat(row.depth || '0'),
            parseFloat(row.weight || '0'),
            parseFloat(row.weight_in_oz || '0'),
            row.image_1,
            row.image_2,
            row.image_3
          ]);
        }
        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.send('ToyHouse master data CSV uploaded successfully!');
      } catch (err) {
        console.error("❌ Error inserting ToyHouse data:", err);
        res.status(500).send('Error uploading ToyHouse data');
      }
    });
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});