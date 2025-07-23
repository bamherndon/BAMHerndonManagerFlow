import React, { useEffect, useState, useRef } from "react";

export default function ReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef(0);

  const SWIPE_THRESHOLD = 50; // px

  useEffect(() => {
    fetch("/api/import-items")
      .then((res) => res.json())
      .then(setItems)
      .catch((err) => console.error("Failed to fetch items:", err));
  }, []);

  if (!items.length) {
    return <div className="p-4">Loading import items...</div>;
  }

  const currentItem = items[currentIndex];
  const patronId = currentItem.po_number.split("-")[1] || "";

  const handleNext = () => {
    setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
  };
  const handlePrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    setSwipeOffset(deltaX);
  };

  const onTouchEnd = () => {
    // Determine swipe direction
    if (swipeOffset > SWIPE_THRESHOLD) {
      // right swipe → Previous
      handlePrev();
    } else if (swipeOffset < -SWIPE_THRESHOLD) {
      // left swipe → Next
      handleNext();
    }
    // animate back to center
    setSwipeOffset(0);
  };

  return (
    <div
      className="p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overflow: "hidden", touchAction: "pan-y" }}
    >
      <div
        className="border p-4 rounded bg-white shadow space-y-2"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.3s ease" : "none",
        }}
      >
        <h2 className="text-lg font-semibold mb-4">
          Reviewing Item {currentIndex + 1} of {items.length}
        </h2>

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
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === items.length - 1}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
