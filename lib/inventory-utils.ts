export type InventoryStack = {
  name: string;
  quantity: number;
};

export function normalizeInventoryName(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function stripInventoryQuantity(value: string): string {
  const text = String(value || '').trim();
  const match = text.match(/^(.*?)(?:\s*\([xX]?(\d+)\))?\s*$/);
  return (match?.[1] || text).trim();
}

export function parseInventoryStacks(inventory: string): InventoryStack[] {
  const byName = new Map<string, InventoryStack>();

  for (const rawLine of String(inventory || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(.*?)(?:\s*\([xX]?(\d+)\))?\s*$/);
    const name = (match?.[1] || line).trim();
    const quantity = Math.max(1, Number(match?.[2] || 1));
    const key = normalizeInventoryName(name);

    const existing = byName.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      byName.set(key, { name, quantity });
    }
  }

  return Array.from(byName.values());
}

export function formatInventoryStacks(stacks: InventoryStack[]): string {
  return stacks
    .filter((stack) => stack.quantity > 0 && stack.name.trim())
    .map((stack) =>
      stack.quantity > 1
        ? `${stack.name} (${stack.quantity})`
        : stack.name
    )
    .join('\n');
}

export function getInventoryQuantity(inventory: string, itemName: string): number {
  const target = normalizeInventoryName(stripInventoryQuantity(itemName));
  const stack = parseInventoryStacks(inventory).find(
    (entry) => normalizeInventoryName(entry.name) === target
  );
  return stack?.quantity || 0;
}

export function addInventoryItem(
  inventory: string,
  itemName: string,
  quantity = 1
): string {
  const amount = Math.max(1, Math.trunc(quantity));
  const cleanName = stripInventoryQuantity(itemName);
  const target = normalizeInventoryName(cleanName);
  const stacks = parseInventoryStacks(inventory);

  const existing = stacks.find(
    (entry) => normalizeInventoryName(entry.name) === target
  );

  if (existing) {
    existing.quantity += amount;
  } else {
    stacks.push({ name: cleanName, quantity: amount });
  }

  return formatInventoryStacks(stacks);
}

export function removeInventoryItem(
  inventory: string,
  itemName: string,
  quantity = 1
): {
  inventory: string;
  removed: number;
  itemName: string;
} {
  const amount = Math.max(1, Math.trunc(quantity));
  const cleanName = stripInventoryQuantity(itemName);
  const target = normalizeInventoryName(cleanName);
  const stacks = parseInventoryStacks(inventory);

  const stack = stacks.find(
    (entry) => normalizeInventoryName(entry.name) === target
  );

  if (!stack || stack.quantity < amount) {
    return {
      inventory,
      removed: 0,
      itemName: cleanName
    };
  }

  stack.quantity -= amount;

  return {
    inventory: formatInventoryStacks(stacks),
    removed: amount,
    itemName: stack.name
  };
}