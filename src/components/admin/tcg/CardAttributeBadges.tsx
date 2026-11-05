import React from 'react';
import { Badge } from '../../common/Badge';
import {
  resolveCardCondition,
  resolveCardLanguage,
  resolveCardFinish,
} from '../../../config/tcgCardOptions';

interface BadgeItemProps {
  value?: string | null;
  size?: 'sm' | 'md';
  useShortLabel?: boolean;
}

export const CardConditionBadge: React.FC<BadgeItemProps> = ({
  value,
  size = 'sm',
  useShortLabel = true,
}) => {
  const opt = resolveCardCondition(value);
  return (
    <span title={opt.label} className="inline-flex">
      <Badge variant={opt.badgeVariant || 'neutral'} size={size}>
        {useShortLabel && opt.shortLabel ? opt.shortLabel : opt.label}
      </Badge>
    </span>
  );
};

export const CardLanguageBadge: React.FC<BadgeItemProps> = ({
  value,
  size = 'sm',
  useShortLabel = true,
}) => {
  const opt = resolveCardLanguage(value);
  return (
    <Badge variant={opt.badgeVariant || 'info'} size={size}>
      {useShortLabel && opt.shortLabel ? opt.shortLabel : opt.label}
    </Badge>
  );
};

export const CardFinishBadge: React.FC<BadgeItemProps> = ({
  value,
  size = 'sm',
  useShortLabel = true,
}) => {
  const opt = resolveCardFinish(value);
  return (
    <Badge variant={opt.badgeVariant || 'neutral'} size={size}>
      {useShortLabel && opt.shortLabel ? opt.shortLabel : opt.label}
    </Badge>
  );
};

