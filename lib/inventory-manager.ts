/**
 * Compatibilidade legada para chamadas antigas de inventário.
 *
 * POLISH-B: a autoridade real de parsing/serialização agora é
 * lib/inventory-utils.ts. Este arquivo mantém apenas a API antiga.
 */

import {
  addInventoryItem,
  formatInventoryStacks,
  getInventoryQuantity,
  parseInventoryStacks,
  removeInventoryItem,
  type InventoryStack
} from './inventory-utils';

export interface InventoryItem {
  name: string;
  quantity: number;
}

export function parseInventory(
  invText = ''
): InventoryItem[] {
  return parseInventoryStacks(
    invText
  ).map(
    (
      item:
        InventoryStack
    ) => ({
      name:
        item.name,
      quantity:
        item.quantity
    })
  );
}

export function serializeInventory(
  items:
    InventoryItem[]
): string {
  return formatInventoryStacks(
    items
  );
}

export function getItemQuantity(
  invText = '',
  itemName: string
): number {
  return getInventoryQuantity(
    invText,
    itemName
  );
}

export function addItemToInventory(
  invText = '',
  itemName: string,
  quantity = 1
): string {
  return addInventoryItem(
    invText,
    itemName,
    quantity
  );
}

export function consumeItemFromInventory(
  invText = '',
  itemName: string,
  quantity = 1
): {
  success: boolean;
  newInventory: string;
  remaining: number;
  consumedName: string;
} {
  const before =
    getInventoryQuantity(
      invText,
      itemName
    );

  if (
    before < quantity
  ) {
    return {
      success: false,
      newInventory:
        invText,
      remaining:
        before,
      consumedName:
        itemName
    };
  }

  const result =
    removeInventoryItem(
      invText,
      itemName,
      quantity
    );

  return {
    success:
      result.removed ===
      quantity,
    newInventory:
      result.inventory,
    remaining:
      getInventoryQuantity(
        result.inventory,
        result.itemName
      ),
    consumedName:
      result.itemName
  };
}
