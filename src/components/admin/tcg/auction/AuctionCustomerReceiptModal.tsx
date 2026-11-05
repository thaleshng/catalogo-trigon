import React, { useRef } from 'react';
import { CustomerArremateGroup, TcgAuctionItem } from '../../../../types';
import { formatCurrency, formatAuctionPeriod } from '../../../../utils/formatters';
import { Modal } from '../../../../components/common/Modal';
import { Button } from '../../../../components/common/Button';
import { useToast } from '../../../../components/common/Toast';
import { auctionService } from '../../../../services/auctionService';
import { Copy, MessageCircle, Package, Printer, User } from 'lucide-react';

interface AuctionCustomerReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: CustomerArremateGroup;
}

export const AuctionCustomerReceiptModal: React.FC<AuctionCustomerReceiptModalProps> = ({
  isOpen,
  onClose,
  group,
}) => {
  const { success, error } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleCopyNotice = async () => {
    const text = auctionService.formatCustomerPaymentNotice({
      customerName: group.customer.name,
      auctionCode: group.auction.code,
      deadlineFormatted: new Date(group.paymentDeadline).toLocaleDateString('pt-BR'),
    });
    try {
      await navigator.clipboard.writeText(text);
      success('Mensagem 1 (Cobrança 48h) copiada para o WhatsApp!');
    } catch {
      error('Falha ao copiar.');
    }
  };

  const handleCopyItems = async () => {
    const text = auctionService.formatCustomerItemsSummary({
      customerName: group.customer.name,
      auctionCode: group.auction.code,
      items: group.items,
      totalValue: group.totalValue,
    });
    try {
      await navigator.clipboard.writeText(text);
      success('Mensagem 2 (Lista de Texto) copiada para o WhatsApp!');
    } catch {
      error('Falha ao copiar.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Extrato de Arremates — ${group.customer.name}`}
      maxWidth="6xl"
    >
      <div className="space-y-4">
        {/* Barra Superior de Ações (Fora da Área de Print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-trigon-950 border border-trigon-800">
          <div className="flex items-center gap-2 text-xs text-trigon-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>
              Tire print da tabela abaixo com <strong>Win + Shift + S</strong> para enviar no WhatsApp.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyItems}
              icon={<Copy className="w-3.5 h-3.5" />}
              title="Copiar lista de cartas em texto para WhatsApp"
            >
              Copiar Mensagem 2 (Lista Texto)
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCopyNotice}
              icon={<MessageCircle className="w-3.5 h-3.5" />}
              title="Copiar mensagem padrão de cobrança 48h com dados de PIX"
            >
              Copiar Mensagem 1 (Cobrança 48h)
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-3.5 h-3.5" />}
              title="Abrir diálogo de impressão do navegador ou salvar em PDF"
            >
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Card Completo para Captura / Print (Sem scroll interno, mostra todas as cartas) */}
        <div
          ref={printRef}
          id="trigon-print-area"
          className="p-6 rounded-2xl bg-gradient-to-br from-[#0c0d12] via-[#090a0f] to-[#12070a] border border-trigon-800 shadow-2xl text-white space-y-5 select-none"
        >
          {/* Cabeçalho do Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-trigon-800/80">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                  group.allPaid
                    ? 'bg-blue-950/80 border-blue-500/40 text-blue-400'
                    : group.isOverdue
                      ? 'bg-crimson-950/80 border-crimson-500/60 text-crimson-400'
                      : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                }`}
              >
                <User className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Nome Completo */}
                  <h2 className="font-bold text-white text-xl tracking-wide">
                    {group.customer.name}
                  </h2>

                  {/* Número do Leilão */}
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-bold bg-trigon-900 border border-trigon-700 text-trigon-300">
                    Leilão #{group.auction.code}
                  </span>

                  {/* Data / Período do Leilão */}
                  {group.auction.startDate && (
                    <span className="px-2.5 py-0.5 rounded-md font-mono text-xs bg-trigon-950 border border-trigon-800 text-trigon-300">
                      📅 {formatAuctionPeriod(group.auction.startDate, group.auction.endDate)}
                    </span>
                  )}

                  {/* Status Pagamento */}
                  {group.allPaid ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      ✓ PAGO
                    </span>
                  ) : group.isOverdue ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-crimson-950 text-crimson-300 border border-crimson-500/60">
                      ⚠️ PRAZO VENCIDO
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                      ⏱ PENDENTE ({group.hoursRemaining > 0 ? `${group.hoursRemaining}h restantes` : 'expirando'})
                    </span>
                  )}

                  {/* Status Envio */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      group.shippingStatus === 'RECEBIDO'
                        ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                        : group.shippingStatus === 'ENVIADO'
                          ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                          : group.shippingStatus === 'SOLICITADO'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : 'bg-trigon-900 text-trigon-400 border border-trigon-750'
                    }`}
                  >
                    📦 Envio: {group.shippingStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-trigon-400 flex-wrap">
                  {group.customer.phone && (
                    <span className="font-mono text-trigon-300">
                      📱 {group.customer.phone}
                    </span>
                  )}
                  <span>
                    Prazo 48h: <strong>{new Date(group.paymentDeadline).toLocaleString('pt-BR')}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Total dos Arremates */}
            <div className="text-right shrink-0">
              <span className="text-[11px] uppercase font-bold text-trigon-400 block tracking-wider">
                Total dos Arremates
              </span>
              <span className="font-mono text-3xl font-black text-emerald-400 block leading-tight">
                {formatCurrency(group.totalValue)}
              </span>
              <span className="text-xs text-trigon-400 block mt-0.5">
                {group.items.length} carta(s) arrematada(s)
              </span>
            </div>
          </div>

          {/* Tabela dos Lotes Arrematados (Sem scroll interno, mostra todas as cartas) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-trigon-400 uppercase tracking-wider border-b border-trigon-800">
                  <th className="pb-3 font-semibold">Carta / Item</th>
                  <th className="pb-3 font-semibold">Coleção</th>
                  <th className="pb-3 font-semibold">Condição</th>
                  <th className="pb-3 font-semibold">Idioma</th>
                  <th className="pb-3 font-semibold">Valor Arremate</th>
                  <th className="pb-3 font-semibold">Status Pagamento</th>
                  <th className="pb-3 font-semibold">Situação Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-850">
                {group.items.map((it: TcgAuctionItem) => {
                  const activePhoto = it.customPhotoUrl || it.apiImageUrl;
                  return (
                    <tr key={it.id} className="hover:bg-trigon-900/30 transition-colors">
                      <td className="py-2.5 flex items-center gap-3">
                        <div className="w-9 h-12 rounded-lg bg-trigon-900 border border-trigon-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {activePhoto ? (
                            <img
                              src={activePhoto}
                              alt={it.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-trigon-600" />
                          )}
                        </div>
                        <span className="font-semibold text-white text-sm">
                          {it.title}
                        </span>
                      </td>

                      <td className="py-2.5 text-trigon-400">
                        {it.subtitle || '—'}
                      </td>

                      <td className="py-2.5">
                        {it.condition ? (
                          <span className="font-medium text-trigon-200">
                            {auctionService.getConditionEmoji(it.condition)} {it.condition}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2.5">
                        {it.language ? (
                          <span className="font-medium text-trigon-200">
                            {auctionService.getLanguageFlag(it.language)} {it.language}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2.5 font-mono text-sm font-bold text-emerald-400">
                        {it.isFreebie ? (
                          <span className="text-purple-300">🎁 BRINDE</span>
                        ) : (
                          formatCurrency(it.finalPrice || it.initialPrice)
                        )}
                      </td>

                      <td className="py-2.5">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-bold border inline-block ${
                            it.paymentStatus === 'PAGO'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {it.paymentStatus === 'PAGO' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>

                      <td className="py-2.5">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-bold border inline-block ${
                            it.shippingStatus === 'RECEBIDO'
                              ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                              : it.shippingStatus === 'ENVIADO'
                                ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                                : it.shippingStatus === 'SOLICITADO'
                                  ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                                  : 'bg-trigon-900 border-trigon-750 text-trigon-400'
                          }`}
                        >
                          {it.shippingStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé do Card com Instruções e Total */}
          <div className="pt-4 border-t border-trigon-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1 text-trigon-300">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-amber-300">💰 Pagamento via PIX:</span>
                <span className="font-mono text-white font-bold">(31) 98341-0432</span>
                <span className="text-trigon-400">• Gabriel Henrique da Silva Gomes — Mercado Pago</span>
              </div>
              <div className="text-[11px] text-trigon-400">
                💳 Cartão de Crédito disponível sob solicitação • 📦 Armazenamento com a TRIGON para economizar no frete
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-trigon-400 block tracking-wider">
                Valor Total a Pagar
              </span>
              <span className="font-mono text-2xl font-black text-emerald-400">
                {formatCurrency(group.totalValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
