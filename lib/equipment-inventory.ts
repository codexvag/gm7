import {
  ITEMS_CATALOG,
  calculateEquippedStats,
  type Character,
  type EquipmentSlots,
  type ItemDefinition
} from './game-engine';

import {
  addInventoryItem,
  normalizeInventoryName,
  removeInventoryItem
} from './inventory-utils';

export type EquipmentSlot =
  keyof EquipmentSlots;

export function resolveCharacterItem(
  hero: Character,
  itemId?: string
): ItemDefinition | undefined {
  if (!itemId) {
    return undefined;
  }

  return (
    hero.inventoryItemData?.[itemId] ||
    ITEMS_CATALOG[itemId]
  );
}

export function getEquipSlotForItem(
  item: Pick<
    ItemDefinition,
    'type' | 'name' | 'acBonus' | 'baseAc'
  >
): EquipmentSlot | null {
  switch (item.type) {
    case 'arma':
      return 'mainHand';

    case 'escudo':
      return 'offHand';

    case 'armadura':
      return 'armor';

    case 'elmo':
      return 'helm';

    case 'botas':
      return 'boots';

    case 'acessorio':
    case 'anel':
      return 'accessory';

    default:
      break;
  }

  /*
   * Compatibilidade com saves antigos: antes deste patch,
   * escudos procedurais eram gravados como tipo "geral".
   */
  const normalizedName =
    normalizeInventoryName(
      item.name
    );

  if (
    item.type === 'geral' &&
    normalizedName.includes(
      'escudo'
    )
  ) {
    return 'offHand';
  }

  return null;
}

export function unequipInventorySlot(
  hero: Character,
  slot: EquipmentSlot
): Character {
  const equippedId =
    hero.equipment?.[slot];

  if (!equippedId) {
    return hero;
  }

  const equippedItem =
    resolveCharacterItem(
      hero,
      equippedId
    );

  const nextEquipment = {
    ...(hero.equipment || {})
  };

  delete nextEquipment[slot];

  const nextInventory =
    addInventoryItem(
      hero.inventory || '',
      equippedItem?.name ||
        equippedId,
      1
    );

  return calculateEquippedStats({
    ...hero,
    inventory:
      nextInventory,
    equipment:
      nextEquipment,
    equipmentInventoryVersion:
      2
  });
}

export function equipInventoryItem(
  hero: Character,
  item: ItemDefinition
): Character {
  const slot =
    getEquipSlotForItem(
      item
    );

  if (!slot) {
    return hero;
  }

  const currentId =
    hero.equipment?.[slot];

  if (
    currentId ===
    item.id
  ) {
    return hero;
  }

  let nextInventory =
    hero.inventory || '';

  const removed =
    removeInventoryItem(
      nextInventory,
      item.name,
      1
    );

  /*
   * Nao cria equipamento do nada: o item precisa existir
   * fisicamente na mochila antes da transacao.
   */
  if (
    removed.removed !== 1
  ) {
    return hero;
  }

  nextInventory =
    removed.inventory;

  if (currentId) {
    const currentItem =
      resolveCharacterItem(
        hero,
        currentId
      );

    nextInventory =
      addInventoryItem(
        nextInventory,
        currentItem?.name ||
          currentId,
        1
      );
  }

  const nextEquipment = {
    ...(hero.equipment || {}),
    [slot]: item.id
  };

  const nextItemData = {
    ...(hero.inventoryItemData || {})
  };

  if (
    !ITEMS_CATALOG[item.id]
  ) {
    nextItemData[item.id] = {
      ...item
    };
  }

  return calculateEquippedStats({
    ...hero,
    inventory:
      nextInventory,
    equipment:
      nextEquipment,
    inventoryItemData:
      nextItemData,
    equipmentInventoryVersion:
      2
  });
}
