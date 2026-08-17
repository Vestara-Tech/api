import { KeyValueList as SharedKeyValueList, type KeyValueItem, type KeyValueListProps as SharedKeyValueListProps } from '@vestara/ui';

export type { KeyValueItem };

export interface KeyValueListProps extends Omit<SharedKeyValueListProps, 'layout' | 'labelWidth'> {}

export function KeyValueList({ items, ...props }: KeyValueListProps) {
  return <SharedKeyValueList items={items} layout="grid" labelWidth={180} {...props} />;
}
