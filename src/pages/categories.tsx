import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LucideIcon } from "@/components/lucide-icon";
import { EmptyState } from "@/components/reactbits/empty-state";
import { FadeIn } from "@/components/reactbits/fade-in";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/db";
import { formatCurrency } from "@/lib/domain/calculations";
import { Category } from "@/lib/domain/types";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

const ICON_OPTIONS = [
  "repeat", "gamepad-2", "utensils", "pizza", "car", "shopping-bag",
  "file-text", "heart-pulse", "ellipsis", "home", "plane", "music",
  "book", "gift", "coffee", "dumbbell", "laptop", "phone", "dog",
  "baby", "briefcase", "graduation-cap", "palette", "wrench",
];

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("circle");
  const [budget, setBudget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setCategories(await getCategories());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditCat(null);
    setName("");
    setIcon("circle");
    setBudget("");
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setBudget(cat.monthlyBudget !== null ? String(cat.monthlyBudget) : "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const budgetVal = budget ? parseFloat(budget) : null;
    if (editCat) {
      await updateCategory(editCat.id, { name: name.trim(), icon, monthlyBudget: budgetVal });
    } else {
      await createCategory({ name: name.trim(), icon, monthlyBudget: budgetVal });
    }
    setModalOpen(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCategory(deleteId);
    setDeleteId(null);
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="No categories"
          description="Create your first category to organize your expenses."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Create Category
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat, i) => (
            <FadeIn key={cat.id} delay={i * 40} duration={200}>
              <Card className="group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <LucideIcon name={cat.icon} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{cat.name}</div>
                      {cat.monthlyBudget !== null && (
                        <div className="text-xs text-muted-foreground">
                          Budget: {formatCurrency(cat.monthlyBudget)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(cat.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleSave(); }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editCat ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editCat ? "Update category details." : "Create a new expense category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      icon === ic ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={() => setIcon(ic)}
                  >
                    <LucideIcon name={ic} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Budget (RON, optional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="No budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {editCat ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Transactions using this category will become uncategorized. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
