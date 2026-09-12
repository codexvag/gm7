/**
 * Pure utility module to manage character inventories with item quantities in D&D 5e format.
 * Supports lines like:
 * - "Poção de Cura (x3)"
 * - "Poção de Cura" (defaults to 1)
 * - "Espada Longa"
 */

export interface InventoryItem {
  name: string;
  quantity: number;
}

function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Parses raw newline-delimited inventory text into structured items with quantities.
 */
export function parseInventory(invText: string = ''): InventoryItem[] {
  const lines = invText.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: InventoryItem[] = [];

  for (const line of lines) {
    // Matches patterns like "Poção de Cura (x3)", "Poção de Cura (3)", or "3x Poção de Cura"
    let name = line;
    let qty = 1;

    const trailingCountMatch = line.match(/^(.*?)\s*\([xX]?(\d+)\)$/);
    const leadingCountMatch = line.match(/^(\d+)[xX]?\s+(.*?)$/);

    if (trailingCountMatch) {
      name = trailingCountMatch[1].trim();
      qty = parseInt(trailingCountMatch[2], 10) || 1;
    } else if (leadingCountMatch) {
      qty = parseInt(leadingCountMatch[1], 10) || 1;
      name = leadingCountMatch[2].trim();
    }

    const norm = normalizeItemName(name);
    const existing = items.find((it) => normalizeItemName(it.name) === norm);
    if (existing) {
      existing.quantity += qty;
    } else {
      items.push({ name, quantity: qty });
    }
  }

  return items;
}

/**
 * Serializes item list back to clean newline-delimited inventory text.
 */
export function serializeInventory(items: InventoryItem[]): string {
  return items
    .filter((it) => it.quantity > 0)
    .map((it) => {
      // Weapons/armors typically don't show (x1) unless stackable or quantity > 1
      if (it.quantity > 1) {
        return `${it.name} (x${it.quantity})`;
      }
      return it.name;
    })
    .join('\n');
}

/**
 * Gets the total available quantity of an item by name or partial match.
 */
export function getItemQuantity(invText: string = '', itemName: string): number {
  const normTarget = normalizeItemName(itemName);
  const items = parseInventory(invText);
  const found = items.find((it) => {
    const n = normalizeItemName(it.name);
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n);
  });
  return found ? found.quantity : 0;
}

/**
 * Adds an item with quantity to the inventory string (accumulating existing stacks).
 */
export function addItemToInventory(invText: string = '', itemName: string, quantity: number = 1): string {
  if (!itemName || quantity <= 0) return invText;
  const items = parseInventory(invText);
  const normTarget = normalizeItemName(itemName);
  const existing = items.find((it) => {
    const n = normalizeItemName(it.name);
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n);
  });

  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ name: itemName.trim(), quantity });
  }

  return serializeInventory(items);
}

/**
 * Consumes a specified quantity of an item from the inventory.
 * Returns success, updated inventory string, and remaining quantity of that item.
 */
export function consumeItemFromInventory(
  invText: string = '',
  itemName: string,
  quantity: number = 1
): { success: boolean; newInventory: string; remaining: number; consumedName: string } {
  const items = parseInventory(invText);
  const normTarget = normalizeItemName(itemName);
  const existing = items.find((it) => {
    const n = normalizeItemName(it.name);
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n);
  });

  if (!existing || existing.quantity < quantity) {
    return {
      success: false,
      newInventory: invText,
      remaining: existing ? existing.quantity : 0,
      consumedName: itemName
    };
  }

  existing.quantity -= quantity;
  const remaining = existing.quantity;
  const consumedName = existing.name;

  return {
    success: true,
    newInventory: serializeInventory(items),
    remaining,
    consumedName
  };
}
