"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  X, 
  Check, 
  ArrowRightLeft, 
  Loader2,
  ExternalLink,
  Image as ImageIcon // Đổi tên để tránh trùng với thẻ Image html
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import test_ingredient_price from '../_components/test_ingredient_price.json';

// --- INTERFACES ---
export interface ProductItem {
  barcode: string | null;
  product_name: string;
  product_brand: string;
  current_price: number;
  product_size: string;
  url: string;
  image_url: string;
}

export interface IngredientStoreGroup {
  supermarket: 'COLES' | 'WOOLWORTHS';
  item_list: ProductItem[];
}

// 2. Cập nhật IngredientPriceList dùng cấu trúc mới
export interface IngredientPriceList {
  ingredient_name: string;
  ingredient_list: IngredientStoreGroup[]; // Thay đổi từ ProductItem[] sang IngredientStoreGroup[]
}

export interface RecipePriceData {
  IngredientPricePerRecipe: IngredientPriceList[];
}

interface IngredientPriceAgentProps {
  isLoading?: boolean;
  recipesPriceData?: RecipePriceData[];
}

// --- HELPER COMPONENTS ---
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- MAIN COMPONENT ---
export const IngredientPriceAgent: React.FC<IngredientPriceAgentProps> = ({ 
  isLoading = false, 
  recipesPriceData = [],
  isExpanded,
  onClose
}) => {
  const [activeRecipeIndex, setActiveRecipeIndex] = useState(0);
  // const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductItem>>({});

  useEffect(() => {
    setActiveRecipeIndex(0);
  }, [recipesPriceData]);

  const currentRecipe = recipesPriceData[activeRecipeIndex];

  const getStoreType = (item: ProductItem): 'COLES' | 'WOOLIES' => {
    if (item.url.includes('coles') || item.product_brand.toLowerCase().includes('coles')) return 'COLES';
    if (item.url.includes('woolworths')) return 'WOOLIES';
    return 'COLES';
  };

  const calculation = useMemo(() => {
    if (!currentRecipe) return { colesTotal: 0, wooliesTotal: 0, ingredients: [] };

    let colesTotal = 0;
    let wooliesTotal = 0;

    const processedIngredients = currentRecipe.IngredientPricePerRecipe.map((ing) => {
        
      const colesOptions = ing.ingredient_list.filter(i => i.supermarket === 'COLES')[0]?.item_list || [];
      const wooliesOptions = ing.ingredient_list.filter(i => i.supermarket === 'WOOLWORTHS')[0]?.item_list || [];
      const colesKey = `${activeRecipeIndex}-${ing.ingredient_name}-COLES`;
      const wooliesKey = `${activeRecipeIndex}-${ing.ingredient_name}-WOOLIES`;

      const selectedColes = selectedVariants[colesKey] || colesOptions[0] || null;
      const selectedWoolies = selectedVariants[wooliesKey] || wooliesOptions[0] || null;

      if (selectedColes) colesTotal += selectedColes.current_price;
      if (selectedWoolies) wooliesTotal += selectedWoolies.current_price;

      return {
        name: ing.ingredient_name,
        coles: { selected: selectedColes, options: colesOptions },
        woolies: { selected: selectedWoolies, options: wooliesOptions }
      };
    });

    return { colesTotal, wooliesTotal, ingredients: processedIngredients };
  }, [currentRecipe, activeRecipeIndex, selectedVariants]);

  const handleSelectVariant = (ingredientName: string, store: 'COLES' | 'WOOLIES', product: ProductItem) => {
    const key = `${activeRecipeIndex}-${ingredientName}-${store}`;
    setSelectedVariants(prev => ({ ...prev, [key]: product }));
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs font-medium">Analyzing prices...</span>
      </div>
    );
  }

  if (!recipesPriceData || recipesPriceData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
        No price data available.
      </div>
    );
  }

  return (
    <>
      {/* === WIDGET VIEW (COMPACT) === */}
      <div className="flex flex-col h-full gap-2">
        <div className="flex flex-col gap-2 mt-1">
          {/* Coles Bar */}
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg p-2.5 px-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-[10px]">C</div>
              <span className="text-sm font-semibold text-slate-700">Coles</span>
            </div>
            <span className="text-lg font-bold text-red-600">${calculation.colesTotal.toFixed(2)}</span>
          </div>

          {/* Woolworths Bar */}
          <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg p-2.5 px-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-[10px]">W</div>
              <span className="text-sm font-semibold text-slate-700">Woolworths</span>
            </div>
            <span className="text-lg font-bold text-green-700">${calculation.wooliesTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
            <div className="flex gap-1.5">
                {recipesPriceData.map((_, idx) => (
                <button
                    key={idx}
                    onClick={() => setActiveRecipeIndex(idx)}
                    className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    idx === activeRecipeIndex ? "bg-slate-800 w-4" : "bg-slate-300 hover:bg-slate-400"
                    )}
                />
                ))}
            </div>

            {/* <button 
                onClick={() => setIsExpanded(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
            >
                Compare & Swap <ChevronRight className="w-3 h-3" />
            </button> */}
        </div>
      </div>

      {/* === EXPANDED VIEW (POPUP FULL SCREEN) === */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Price Breakdown</h2>
                <p className="text-xs text-slate-500">Recipe {activeRecipeIndex + 1}/{recipesPriceData.length}</p>
              </div>
              <button 
                onClick={onClose} //{() => setIsExpanded(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 mb-4 sticky top-0 z-10 bg-slate-50 pb-2">
                 <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col items-center">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Coles Total</span>
                    <span className="text-2xl font-bold text-slate-800">${calculation.colesTotal.toFixed(2)}</span>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex flex-col items-center">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Woolworths Total</span>
                    <span className="text-2xl font-bold text-slate-800">${calculation.wooliesTotal.toFixed(2)}</span>
                 </div>
              </div>

              {/* Ingredients List Table */}
              <div className="space-y-3 pb-10">
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 px-2 uppercase tracking-wide">
                    <div className="col-span-4">Ingredient</div>
                    <div className="col-span-4 text-center">Coles Option</div>
                    <div className="col-span-4 text-center">Woolworths Option</div>
                </div>

                {calculation.ingredients.map((item, idx) => (
                   <IngredientComparisonRow 
                      key={idx}
                      ingredientName={item.name}
                      colesData={item.coles}
                      wooliesData={item.woolies}
                      onSelectColes={(prod) => handleSelectVariant(item.name, 'COLES', prod)}
                      onSelectWoolies={(prod) => handleSelectVariant(item.name, 'WOOLIES', prod)}
                   />
                ))}
              </div>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// --- SUB-COMPONENT: ROW SO SÁNH ---
interface IngredientComparisonRowProps {
    ingredientName: string;
    colesData: { selected: ProductItem | null, options: ProductItem[] };
    wooliesData: { selected: ProductItem | null, options: ProductItem[] };
    onSelectColes: (p: ProductItem) => void;
    onSelectWoolies: (p: ProductItem) => void;
}

const IngredientComparisonRow: React.FC<IngredientComparisonRowProps> = ({
    ingredientName, colesData, wooliesData, onSelectColes, onSelectWoolies
}) => {
    // State dropdown
    const [openSelectorStore, setOpenSelectorStore] = useState<'COLES' | 'WOOLIES' | null>(null);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="grid grid-cols-12 gap-3 items-center">
                {/* Ingredient Name */}
                <div className="col-span-4">
                    <h4 className="font-semibold text-slate-700 text-sm leading-tight capitalize">
                        {ingredientName}
                    </h4>
                </div>

                {/* Coles Cell */}
                <div className="col-span-4">
                    <ProductCell 
                        store="COLES"
                        product={colesData.selected}
                        onClick={() => setOpenSelectorStore(openSelectorStore === 'COLES' ? null : 'COLES')}
                        hasAlternatives={colesData.options.length > 1}
                    />
                </div>

                {/* Woolies Cell */}
                <div className="col-span-4">
                     <ProductCell 
                        store="WOOLIES"
                        product={wooliesData.selected}
                        onClick={() => setOpenSelectorStore(openSelectorStore === 'WOOLIES' ? null : 'WOOLIES')}
                        hasAlternatives={wooliesData.options.length > 1}
                    />
                </div>
            </div>

            {/* Dropdown Selector */}
            <AnimatePresence>
                {openSelectorStore && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-2 border-t border-dashed border-slate-200"
                    >
                        <div className="pt-3 pb-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">
                                    Select {openSelectorStore === 'COLES' ? 'Coles' : 'Woolworths'} Product
                                </span>
                                <button onClick={() => setOpenSelectorStore(null)} className="text-xs text-blue-500 font-medium">Close</button>
                            </div>
                            
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {(openSelectorStore === 'COLES' ? colesData.options : wooliesData.options).map((opt, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => {
                                            if(openSelectorStore === 'COLES') onSelectColes(opt);
                                            else onSelectWoolies(opt);
                                            setOpenSelectorStore(null);
                                        }}
                                        className="w-full text-left flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 group transition-all"
                                    >
                                        {/* Ảnh sản phẩm trong dropdown */}
                                        <div className="w-10 h-10 shrink-0 bg-white rounded border border-slate-100 flex items-center justify-center p-0.5">
                                            {opt.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={opt.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                            ) : (
                                                <ImageIcon className="w-4 h-4 text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs text-slate-700 font-medium line-clamp-1 group-hover:text-blue-600 transition-colors">
                                                {opt.product_name}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{opt.product_size}</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-slate-800">${opt.current_price}</span>
                                            
                                            {/* Nút Visit Page */}
                                            <a 
                                                href={opt.url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()} // Chặn click chọn sản phẩm
                                                className="p-1.5 bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"
                                                title="Visit Website"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>

                                            {(openSelectorStore === 'COLES' ? colesData.selected : wooliesData.selected)?.url === opt.url && (
                                                <Check className="w-4 h-4 text-blue-500" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                                {(openSelectorStore === 'COLES' ? colesData.options : wooliesData.options).length === 0 && (
                                    <div className="text-center text-xs text-slate-400 py-2">No alternatives found</div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- SUB-COMPONENT: Ô SẢN PHẨM (ĐÃ SỬA CÓ ẢNH) ---
const ProductCell = ({ 
    store, 
    product, 
    onClick, 
    hasAlternatives 
}: { 
    store: 'COLES' | 'WOOLIES', 
    product: ProductItem | null, 
    onClick: () => void,
    hasAlternatives: boolean
}) => {
    const isColes = store === 'COLES';
    const borderColor = isColes ? 'border-red-100' : 'border-green-100';
    const bgColor = isColes ? 'bg-red-50/50' : 'bg-green-50/50';
    const textColor = isColes ? 'text-red-700' : 'text-green-700';

    if (!product) {
        return (
            <div className="h-full min-h-[60px] flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 italic">Not found</span>
            </div>
        );
    }

    return (
        <button 
            onClick={onClick}
            disabled={!hasAlternatives}
            className={cn(
                "w-full h-full min-h-[60px] p-2 rounded-lg border flex gap-2 items-center text-left transition-all relative group",
                borderColor, bgColor,
                hasAlternatives ? "cursor-pointer hover:bg-white hover:shadow-sm" : "cursor-default"
            )}
        >
            {/* Ảnh sản phẩm (Thumbnail) */}
            <div className="w-10 h-10 shrink-0 bg-white rounded-md border border-white/50 shadow-sm flex items-center justify-center p-0.5 overflow-hidden">
                {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                        src={product.image_url} 
                        alt="" 
                        className="w-full h-full object-contain mix-blend-multiply" 
                    />
                ) : (
                    <ImageIcon className="w-4 h-4 text-slate-300" />
                )}
            </div>

            {/* Thông tin Text */}
            <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                <p className="text-[10px] leading-tight font-medium text-slate-700 line-clamp-2 mb-0.5">
                    {product.product_name}
                </p>
                <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-bold", textColor)}>
                        ${product.current_price}
                    </span>
                    {hasAlternatives && (
                        <ArrowRightLeft className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </div>
        </button>
    );
};