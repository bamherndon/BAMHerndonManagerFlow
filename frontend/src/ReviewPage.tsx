// frontend/src/ReviewPage.tsx
import React, { useEffect, useState } from "react";

export default function ReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch("/api/import-items")
      .then((res) => res.json())
      .then(setItems)
      .catch((err) => console.error("Failed to fetch items:", err));
  }, []);

  if (items.length === 0) {
    return <div className="p-4">Loading import items...</div>;
  }

  const currentItem = items[currentIndex];
  const patronId = currentItem.po_number.split("-")[1] || "";

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">
        Reviewing Item {currentIndex + 1} of {items.length}
      </h2>

      <div className="border p-4 rounded bg-white shadow space-y-2">
        <p>
          <strong>Patron trade:</strong>{" "}
          <a
            href={`https://patron.bricksandminifigs.com/buys/${patronId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {currentItem.po_number}
          </a>
        </p>

        <p>
          <strong>Item Description:</strong> {currentItem.item_description}
        </p>

        <p>
          <strong>Item number:</strong>{" "}
          <a
            href={`https://patron.bricksandminifigs.com/sets/${currentItem.item_bricklink_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {currentItem.item_number}
          </a>
        </p>

        <p>
          <strong>Quantity:</strong> {currentItem.po_line_qty}
        </p>

        <p>
          <strong>Unit Cost:</strong> ${currentItem.po_line_unit_cost}
        </p>

        <p className="flex items-center">
          <strong className="mr-2">Current Price:</strong>
          <input
            type="number"
            step="0.01"
            value={currentItem.item_current_price}
            onChange={(e) => {
              const newPrice = parseFloat(e.target.value) || 0;
              setItems((prev) => {
                const updated = [...prev];
                updated[currentIndex] = {
                  ...updated[currentIndex],
                  item_current_price: newPrice,
                };
                return updated;
              });
            }}
            className="border p-1 rounded w-24"
          />
        </p>

        <p>
          <strong>Bricklink ID:</strong> {currentItem.item_bricklink_id}
        </p>
      </div>

      <div className="flex justify-between mt-4">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() =>
            setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))
          }
          disabled={currentIndex === items.length - 1}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
