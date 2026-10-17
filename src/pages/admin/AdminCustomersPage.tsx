import React, { useEffect, useState } from 'react';
import { Customer } from '../../types';
import { customerService } from '../../services/customerService';
import { cepService } from '../../services/cepService';
import { useToast } from '../../components/common/Toast';
import { formatDateTime, formatPhoneMask, formatCepMask } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Edit2,
  Trash2,
  MessageSquare,
  FileText,
  MapPin,
  Loader2,
  Copy,
  Check,
  Gift,
  Compass,
} from 'lucide-react';
import { CustomerGiftsModal } from '../../components/admin/CustomerGiftsModal';
import { CustomerQuestModal } from '../../components/admin/CustomerQuestModal';

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Customer Gifts Modal State
  const [giftsCustomer, setGiftsCustomer] = useState<Customer | null>(null);
  const [isGiftsModalOpen, setIsGiftsModalOpen] = useState(false);

  // Customer Quest Modal State
  const [questCustomer, setQuestCustomer] = useState<Customer | null>(null);
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);

  const emptyForm = {
    name: '',
    phone: '',
    email: '',
    notes: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    referencePoint: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { success, error } = useToast();

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error(err);
      error('Falha ao carregar lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: formatPhoneMask(customer.phone),
      email: customer.email || '',
      notes: customer.notes || '',
      cep: customer.cep ? formatCepMask(customer.cep) : '',
      street: customer.street || '',
      number: customer.number || '',
      complement: customer.complement || '',
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      state: customer.state || '',
      referencePoint: customer.referencePoint || '',
    });
    setIsFormOpen(true);
  };

  const handleOpenGifts = (customer: Customer) => {
    setGiftsCustomer(customer);
    setIsGiftsModalOpen(true);
  };

  const handleOpenQuest = (customer: Customer) => {
    setQuestCustomer(customer);
    setIsQuestModalOpen(true);
  };

  const handleCepChange = async (val: string) => {
    const masked = formatCepMask(val);
    setFormData((prev) => ({ ...prev, cep: masked }));

    const digits = masked.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      try {
        const addr = await cepService.searchCep(digits);
        if (addr) {
          setFormData((prev) => ({
            ...prev,
            street: addr.street || prev.street,
            neighborhood: addr.neighborhood || prev.neighborhood,
            city: addr.city || prev.city,
            state: addr.state || prev.state,
          }));
          success('Endereço localizado pelo CEP!');
          setTimeout(() => {
            document.getElementById('cust-number-input')?.focus();
          }, 100);
        } else {
          error('CEP não localizado. Preencha o endereço manualmente.');
        }
      } catch {
        error('Falha ao consultar ViaCEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleTriggerCepSearch = () => {
    if (formData.cep) {
      handleCepChange(formData.cep);
    }
  };

  const handleCopyAddress = (cust: Customer) => {
    if (!cust.street && !cust.cep) {
      error('Este cliente ainda não tem endereço cadastrado.');
      return;
    }

    const lines = [
      `Destinatário: ${cust.name}`,
      `Telefone: ${cust.phone}`,
      `Endereço: ${cust.street || ''}, ${cust.number || 'S/N'}${cust.complement ? ` - ${cust.complement}` : ''}`,
      `Bairro: ${cust.neighborhood || ''}`,
      `Cidade/UF: ${cust.city || ''}/${cust.state || ''}`,
      `CEP: ${cust.cep || ''}`,
    ];

    if (cust.referencePoint) {
      lines.push(`Ponto de Referência: ${cust.referencePoint}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(cust.id);
    setTimeout(() => setCopiedId(null), 2500);
    success(`Etiqueta de envio de "${cust.name}" copiada com sucesso!`);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      error('O nome do cliente é obrigatório.');
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!phoneDigits) {
      error('O telefone / WhatsApp é obrigatório.');
      return;
    }

    if (phoneDigits.length < 10) {
      error('Informe o telefone com DDD no formato (xx) xxxxx-xxxx.');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        notes: formData.notes,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        referencePoint: formData.referencePoint,
      };

      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.id, payload);
        success(`Cliente "${formData.name}" atualizado com sucesso!`);
      } else {
        await customerService.createCustomer(payload);
        success(`Cliente "${formData.name}" cadastrado com sucesso!`);
      }
      setIsFormOpen(false);
      loadCustomers();
    } catch (err: any) {
      error(err.message || 'Erro ao salvar cliente');
    }
  };

  const handleRequestDelete = (customer: Customer) => {
    setDeleteTarget(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await customerService.deleteCustomer(deleteTarget.id);
      success(`Cliente "${deleteTarget.name}" excluído com sucesso!`);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadCustomers();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir cliente');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      c.phone.includes(search.trim()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase().trim())) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase().trim())) ||
      (c.neighborhood && c.neighborhood.toLowerCase().includes(search.toLowerCase().trim())) ||
      (c.cep && c.cep.includes(search.trim())) ||
      (c.street && c.street.toLowerCase().includes(search.toLowerCase().trim()))
  );

  const getCleanPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            Gerenciamento de Clientes
          </h1>
          <p className="text-sm text-trigon-400 mt-1">
            Base de compradores, endereços para envio com ViaCEP e contatos de WhatsApp
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Novo Cliente
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-trigon-900/60 p-4 rounded-2xl border border-trigon-800">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, cidade ou CEP..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 placeholder-trigon-600"
          />
        </div>
        <div className="text-xs text-trigon-400 font-medium">
          Total: <strong className="text-white font-mono">{customers.length}</strong> clientes
        </div>
      </div>

      {/* Customer List / Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-trigon-900/40 animate-pulse border border-trigon-800" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-trigon-900/40 rounded-2xl border border-trigon-800 p-8 space-y-3">
          <Users className="w-12 h-12 text-trigon-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-trigon-400">
            Cadastre seu primeiro comprador clicando em "Novo Cliente" acima.
          </p>
        </div>
      ) : (
        <div className="bg-trigon-900 border border-trigon-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-trigon-300">
              <thead className="bg-trigon-950/80 text-xs uppercase font-semibold text-trigon-400 border-b border-trigon-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Contato</th>
                  <th className="py-3.5 px-4">Endereço de Envio</th>
                  <th className="py-3.5 px-4">Observações</th>
                  <th className="py-3.5 px-4">Cadastro</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trigon-800/60">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-trigon-800/30 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-crimson-950/80 border border-crimson-600/40 text-crimson-400 font-bold flex items-center justify-center text-sm shrink-0">
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{cust.name}</span>
                          {cust.email && (
                            <span className="text-[11px] text-trigon-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-trigon-500" />
                              {cust.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone & WhatsApp link */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs">{cust.phone}</span>
                        <a
                          href={`https://wa.me/${getCleanPhone(cust.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 transition-colors"
                          title="Iniciar conversa no WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </td>

                    {/* Shipping Address */}
                    <td className="py-3.5 px-4">
                      {cust.street || cust.cep ? (
                        <div className="space-y-0.5 max-w-xs">
                          <p className="text-xs text-white font-medium flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 text-crimson-400 shrink-0" />
                            <span>
                              {cust.street}, {cust.number || 'S/N'}
                              {cust.complement ? ` (${cust.complement})` : ''}
                            </span>
                          </p>
                          <p className="text-[11px] text-trigon-400 truncate">
                            {cust.neighborhood ? `${cust.neighborhood} • ` : ''}
                            {cust.city}/{cust.state}
                            {cust.cep ? ` • CEP ${cust.cep}` : ''}
                          </p>
                          {cust.referencePoint && (
                            <p className="text-[10px] text-amber-300/80 truncate italic">
                              Ref: {cust.referencePoint}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-trigon-600 italic">Sem endereço cadastrado</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 text-xs max-w-[180px] truncate">
                      {cust.notes ? (
                        <span className="text-trigon-300">{cust.notes}</span>
                      ) : (
                        <span className="text-trigon-600 italic">—</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-xs text-trigon-400 font-mono">
                      {formatDateTime(cust.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Copy Shipping Address Button */}
                        {(cust.street || cust.cep) && (
                          <button
                            onClick={() => handleCopyAddress(cust)}
                            className="p-1.5 rounded-lg border border-emerald-800/50 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                            title="Copiar etiqueta de envio para Correios/Transportadora"
                          >
                            {copiedId === cust.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {/* Gerenciamento de Brindes do Cliente */}
                        <button
                          onClick={() => handleOpenGifts(cust)}
                          className="p-1.5 rounded-lg border border-purple-800/50 text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 transition-colors"
                          title="Gerenciar Brindes do Cliente"
                        >
                          <Gift className="w-3.5 h-3.5" />
                        </button>

                        {/* Programa de Fidelidade Quest TRIGON */}
                        <button
                          onClick={() => handleOpenQuest(cust)}
                          className="p-1.5 rounded-lg border border-amber-800/50 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors"
                          title="Programa de Fidelidade Quest TRIGON"
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(cust)}
                          className="p-1.5 rounded-lg border border-trigon-750 text-trigon-300 hover:text-white hover:bg-trigon-800 transition-colors"
                          title="Editar Cliente"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(cust)}
                          className="p-1.5 rounded-lg border border-crimson-900/40 text-crimson-400 hover:text-crimson-300 hover:bg-crimson-950/40 transition-colors"
                          title="Excluir Cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Cliente */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
        description="Cadastre os dados de contato e endereço de envio do comprador"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-5">
          {/* SEÇÃO 1: Dados Básicos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-trigon-400 tracking-wider">
              Identificação & Contato
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Clóvis da Silva"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  WhatsApp / Telefone *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: formatPhoneMask(e.target.value) })
                    }
                    maxLength={15}
                    placeholder="(xx) xxxxx-xxxx"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono tracking-wide"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  E-mail (Opcional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-trigon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@exemplo.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Endereço de Envio com Autopreenchimento ViaCEP */}
          <div className="space-y-3 pt-3 border-t border-trigon-800/80">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-trigon-400 tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-crimson-400" />
                <span>Endereço de Envio (Correios / Transportadora)</span>
              </h4>
              <span className="text-[11px] text-trigon-500">
                Digite o CEP para buscar rua, bairro e cidade
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* CEP */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  CEP
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    maxLength={9}
                    placeholder="00000-000"
                    className="w-full px-3.5 pr-10 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handleTriggerCepSearch}
                    disabled={loadingCep}
                    className="absolute right-2 p-1.5 rounded-lg text-trigon-400 hover:text-white transition-colors"
                    title="Buscar dados no ViaCEP"
                  >
                    {loadingCep ? (
                      <Loader2 className="w-4 h-4 text-crimson-400 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bairro */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  placeholder="Ex: Centro"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              {/* Cidade / Estado */}
              <div className="sm:col-span-1 grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Ex: São Paulo"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    placeholder="SP"
                    className="w-full px-2.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 text-center font-mono uppercase"
                  />
                </div>
              </div>

              {/* Rua / Logradouro */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Rua / Logradouro
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Ex: Av. Paulista"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              {/* Número */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Número
                </label>
                <input
                  id="cust-number-input"
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="Ex: 1578 ou S/N"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 font-mono"
                />
              </div>

              {/* Complemento */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  placeholder="Ex: Apto 42, Bloco C"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>

              {/* Ponto de Referência */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
                  Ponto de Referência
                </label>
                <input
                  type="text"
                  value={formData.referencePoint}
                  onChange={(e) => setFormData({ ...formData, referencePoint: e.target.value })}
                  placeholder="Ex: Próximo ao metrô, casa amarela com portão de ferro"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: Observações / Preferências */}
          <div className="pt-2 border-t border-trigon-800/80">
            <label className="block text-xs font-semibold uppercase text-trigon-300 mb-1">
              Observações / Preferências (Opcional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-trigon-500 absolute left-3.5 top-3" />
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ex: Prefere envio via Sedex, colecionador de cartas vintage..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-trigon-950 border border-trigon-750 text-white text-sm focus:outline-none focus:border-crimson-500 resize-none placeholder-trigon-600"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-trigon-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingCustomer ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Cliente?"
        message={`Deseja realmente remover o cliente "${deleteTarget?.name}"? Esta ação não afetará o histórico de vendas já concluídas.`}
        confirmText="Sim, excluir"
        variant="danger"
      />

      {/* Modal de Brindes do Cliente */}
      <CustomerGiftsModal
        isOpen={isGiftsModalOpen}
        onClose={() => {
          setIsGiftsModalOpen(false);
          setGiftsCustomer(null);
        }}
        customer={giftsCustomer}
      />

      {/* Modal de Quest TRIGON do Cliente */}
      <CustomerQuestModal
        isOpen={isQuestModalOpen}
        onClose={() => {
          setIsQuestModalOpen(false);
          setQuestCustomer(null);
        }}
        customer={questCustomer}
      />
    </div>
  );
};
