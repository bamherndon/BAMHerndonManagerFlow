// frontend/src/ReviewPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

type Selection = { subDepartment: string; subCategory: string };
type ErrorState = { index: number; field: 'price' | 'subDepartment' };

export default function ReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<number, Selection>>({});
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 50;

  const { po } = useParams<{ po: string }>();

  const departmentOptions: Record<string, { subDepartments: string[]; subCategories: string[] }> = {
    'Used Sets': {
      subDepartments: ['Used Set'],
      subCategories: [
        'Pre-Built Set',
        'Project Set',
        'Allowance Set',
        'Incomplete Set',
        'Certified Used Set',
      ],
    },
    'New Sets': {
      subDepartments: ['New In Box', 'Retired New In Box'],
      subCategories: ['Boxed Set', 'Polybag/Paper Bag'],
    },
  };

  useEffect(() => {
    fetch(`/api/import-items${po ? '?po=' + encodeURIComponent(po) : ''}`)
      .then(r => r.json())
      .then(setItems)
      .catch(console.error);
  }, [po]);

  useEffect(() => {
    if (errorState) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [errorState]);

  if (!items.length) {
    return <div className="p-4">Loading import items...</div>;
  }

  const currentItem = items[currentIndex];
  const opts = departmentOptions[currentItem.item_department] || {
    subDepartments: [],
    subCategories: [],
  };
  const selection = selections[currentIndex] || { subDepartment: '', subCategory: '' };

  const animateMove = (targetX: number, cb: () => void) => {
    setIsTransitioning(true);
    setSwipeOffset(targetX);
    setTimeout(() => {
      cb();
      setSwipeOffset(0);
      setIsTransitioning(false);
    }, 300);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      animateMove(-window.innerWidth, () => setCurrentIndex(i => i + 1));
    } else {
      animateMove(0, () => {});
    }
    setImportMessage(null);
    setErrorState(null);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      animateMove(window.innerWidth, () => setCurrentIndex(i => i - 1));
    } else {
      animateMove(0, () => {});
    }
    setImportMessage(null);
    setErrorState(null);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    setSwipeOffset(e.touches[0].clientX - touchStartX.current);
  };

  const onTouchEnd = () => {
    if (isTransitioning) return;
    if (swipeOffset < -SWIPE_THRESHOLD) handleNext();
    else if (swipeOffset > SWIPE_THRESHOLD) handlePrev();
    else animateMove(0, () => {});
  };

  const handleImport = async () => {
    setImportMessage(null);
    setErrorState(null);

    for (let i = 0; i < items.length; i++) {
      const price = items[i].item_current_price;
      const subDept = selections[i]?.subDepartment;
      if (price == null || isNaN(price)) {
        setErrorState({ index: i, field: 'price' });
        setCurrentIndex(i);
        setImportMessage(`Error: Item ${i + 1} is missing a valid Current Price.`);
        return;
      }
      if (!subDept) {
        setErrorState({ index: i, field: 'subDepartment' });
        setCurrentIndex(i);
        setImportMessage(`Error: Item ${i + 1} is missing an Item Sub department.`);
        return;
      }
    }

    await fetch(`/api/po-import-master/${encodeURIComponent(po!)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    });

    setImportMessage('Starting Import into heartland');
  };

  return (
    <div
      className="p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        ref={cardRef}
        className="border p-4 rounded bg-white shadow flex flex-col"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isTransitioning ? 'transform 0.3s ease' : 'none',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <div>
            <strong>Patron trade:</strong>{' '}
            <a
              href={`https://patron.bricksandminifigs.com/buys/${currentItem.po_number.split('-')[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {currentItem.po_number}
            </a>
          </div>
          <button
            onClick={handleImport}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Import into heartland
          </button>
        </div>

        {/* Import Message */}
        {importMessage && (
          <div className="mb-4 font-medium text-red-700">{importMessage}</div>
        )}

        {/* Item Description at Top */}
        <div className="text-center font-bold text-2xl mb-4">
          {currentItem.item_description}
        </div>

        {/* Card Body */}
        <div className="flex items-start">
          <div className="flex-1 space-y-2">
            <p>
              <strong>Item Department:</strong> {currentItem.item_department}
            </p>

            <p>
              <strong>Item Sub department:</strong>{' '}
              <select
                value={selection.subDepartment}
                onChange={e =>
                  setSelections(prev => ({
                    ...prev,
                    [currentIndex]: {
                      ...selection,
                      subDepartment: e.target.value,
                    },
                  }))
                }
                className={`border rounded p-1 ${
                  errorState?.index === currentIndex && errorState.field === 'subDepartment'
                    ? 'border-red-500'
                    : ''
                }`}
              >
                <option value="">Select...</option>
                {opts.subDepartments.map(sd => (
                  <option key={sd} value={sd}>
                    {sd}
                  </option>
                ))}
              </select>
            </p>

            <p>
              <strong>Item Sub category:</strong>{' '}
              <select
                value={selection.subCategory}
                onChange={e =>
                  setSelections(prev => ({
                    ...prev,
                    [currentIndex]: {
                      ...selection,
                      subCategory: e.target.value,
                    },
                  }))
                }
                className="border rounded p-1"
              >
                <option value="">Select...</option>
                {opts.subCategories.map(sc => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </p>

            <p>
              <strong>Item number:</strong>{' '}
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
                onChange={e => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  setItems(prev => {
                    const updated = [...prev];
                    updated[currentIndex] = {
                      ...updated[currentIndex],
                      item_current_price: newPrice,
                    };
                    return updated;
                  });
                }}
                className={`border p-1 rounded w-24 ${
                  errorState?.index === currentIndex && errorState.field === 'price'
                    ? 'border-red-500'
                    : ''
                }`}
              />
            </p>

            <p>
              <strong>Bricklink ID:</strong> {currentItem.item_bricklink_id}
            </p>
          </div>

          {currentItem.image_url && (
            <img
              src={currentItem.image_url}
              alt={currentItem.item_description}
              className="w-96 h-auto ml-4 rounded"
            />
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
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
