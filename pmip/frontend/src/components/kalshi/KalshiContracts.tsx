import { TrendingUp, ExternalLink } from 'lucide-react';
import type { KalshiContract } from '../../lib/api';

interface Props {
  contracts: KalshiContract[];
  compact?: boolean;
}

export default function KalshiContracts({ contracts, compact = false }: Props) {
  if (!contracts || contracts.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <TrendingUp size={11} style={{ color: 'var(--color-market)' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-market)' }}>
          {contracts.length} market{contracts.length !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="text-[10px] font-bold uppercase tracking-widest mb-2"
        style={{ color: 'var(--color-market)' }}
      >
        Prediction Markets
      </div>
      {contracts.map((contract) => (
        <div
          key={contract.id}
          className="border rounded p-2.5"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="text-[12px] font-medium leading-snug" style={{ color: 'var(--color-text)' }}>
              {contract.title}
            </div>
            <a
              href={contract.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-brand)' }}
            >
              <ExternalLink size={11} />
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Category */}
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(43,58,140,0.1)',
                color: 'var(--color-brand)',
              }}
            >
              {contract.category}
            </span>

            {/* Yes price */}
            <div className="flex items-center gap-1">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--color-market)' }}
              >
                YES {Math.round(contract.yesPrice * 100)}¢
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(232,64,64,0.08)',
                  color: 'var(--color-alert)',
                }}
              >
                NO {Math.round(contract.noPrice * 100)}¢
              </span>
            </div>

            {/* Volume */}
            <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              Vol: ${(contract.volume / 1000).toFixed(0)}K
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
