'use client';

import { useState, useEffect } from 'react';
import { inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Search, Plus, Trash2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

interface Ingredient {
    inventory_item_id: string;
    quantity_required: number;
    unit: string;
    is_optional: boolean;
    inventory_item?: {
        name: string;
        sku: string;
        unit: string;
        current_stock: number;
    };
}

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    unit: string;
    current_stock: number;
}

interface RecipeEditorProps {
    menuItemId: string;
    onSave?: () => void;
    isSession?: boolean;
}

export function RecipeEditor({ menuItemId, onSave, isSession = false }: RecipeEditorProps) {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showItemSelector, setShowItemSelector] = useState(false);

    useEffect(() => {
        fetchData();
    }, [menuItemId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [recipeRes, invRes] = await Promise.all([
                isSession ? inventoryApi.getSessionRecipe(menuItemId) : inventoryApi.getRecipe(menuItemId),
                inventoryApi.getItems()
            ]);
            setIngredients(recipeRes.data.data || []);
            setInventoryItems(invRes.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch recipe data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddIngredient = (item: InventoryItem) => {
        if (ingredients.some(ing => ing.inventory_item_id === item.id)) {
            toast.error('Item already in recipe');
            return;
        }

        const newIngredient: Ingredient = {
            inventory_item_id: item.id,
            quantity_required: 1,
            unit: item.unit || 'unit',
            is_optional: false,
            inventory_item: {
                name: item.name,
                sku: item.sku,
                unit: item.unit,
                current_stock: item.current_stock
            }
        };

        setIngredients([...ingredients, newIngredient]);
        setShowItemSelector(false);
    };

    const handleRemoveIngredient = (index: number) => {
        const newIngredients = [...ingredients];
        newIngredients.splice(index, 1);
        setIngredients(newIngredients);
    };

    const handleUpdateIngredient = (index: number, updates: Partial<Ingredient>) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], ...updates };
        setIngredients(newIngredients);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = ingredients.map(ing => ({
                inventoryItemId: ing.inventory_item_id,
                quantityRequired: Number(ing.quantity_required),
                unit: ing.unit,
                isOptional: ing.is_optional
            }));

            if (isSession) {
                await inventoryApi.updateSessionRecipe(menuItemId, payload);
            } else {
                await inventoryApi.updateRecipe(menuItemId, payload);
            }
            toast.success(isSession ? 'Consumables updated successfully' : 'Recipe updated successfully');
            if (onSave) onSave();
        } catch (error) {
            toast.error('Failed to save recipe');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const filteredInventory = inventoryItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                        {isSession ? 'Consumables & Ingredients' : 'Ingredients & Recipe'}
                    </h4>
                    <p className="text-sm text-slate-500">
                        {isSession
                            ? 'Define what items are consumed per guest when booking this session'
                            : 'Define what ingredients are consumed when this item is ordered'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowItemSelector(!showItemSelector)}
                    className="gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Ingredient
                </Button>
            </div>

            {showItemSelector && (
                <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-900/10 mb-4">
                    <CardContent className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search inventory items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {filteredInventory.length === 0 ? (
                                <p className="text-center py-4 text-sm text-slate-500">No items found</p>
                            ) : (
                                filteredInventory.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddIngredient(item)}
                                        className="w-full flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-sm transition-colors text-left"
                                    >
                                        <div>
                                            <span className="font-medium">{item.name}</span>
                                            <span className="ml-2 text-xs text-slate-500">({item.sku})</span>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Stock: {item.current_stock} {item.unit}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-3">
                {ingredients.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500">No ingredients defined for this item</p>
                        <p className="text-xs text-slate-400 mt-1">Add ingredients to enable automatic stock deduction</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                            <div className="col-span-6">Ingredient</div>
                            <div className="col-span-3">Quantity</div>
                            <div className="col-span-2">Unit</div>
                            <div className="col-span-1"></div>
                        </div>
                        {ingredients.map((ing, index) => (
                            <div key={ing.inventory_item_id} className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="col-span-6">
                                    <p className="font-medium text-sm">{ing.inventory_item?.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{ing.inventory_item?.sku}</p>
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        type="number"
                                        step="0.001"
                                        value={ing.quantity_required.toString()}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            handleUpdateIngredient(index, { quantity_required: val });
                                        }}
                                        className="h-8"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <select
                                        value={ing.unit}
                                        onChange={(e) => handleUpdateIngredient(index, { unit: e.target.value })}
                                        className="w-full text-xs h-8 bg-transparent border border-slate-200 dark:border-slate-700 rounded-md"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="l">l</option>
                                        <option value="ml">ml</option>
                                        <option value="unit">unit</option>
                                        <option value="box">box</option>
                                    </select>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => handleRemoveIngredient(index)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Recipe
                </Button>
            </div>
        </div>
    );
}
