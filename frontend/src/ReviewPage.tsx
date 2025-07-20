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

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">
        Reviewing Item {currentIndex + 1} of {items.length}
      </h2>
      <div className="border p-4 rounded bg-white shadow">
        <p>
          <strong>PO Number:</strong> {currentItem.po_number}
        </p>
        <p>
          <strong>Item Description:</strong> {currentItem.item_description}
        </p>
        <p>
          <strong>Quantity:</strong> {currentItem.po_line_qty}
        </p>
        <p>
          <strong>Unit Cost:</strong> ${currentItem.po_line_unit_cost}
        </p>
        <p>
          <strong>Current Price:</strong> ${currentItem.item_current_price}
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
