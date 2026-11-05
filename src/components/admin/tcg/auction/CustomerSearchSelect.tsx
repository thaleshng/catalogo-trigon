import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer } from '../../../../types';
import { Search, X, ChevronDown, Check, User } from 'lucide-react';

interface CustomerSearchSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  accentColor?: 'emerald' | 'amber' | 'crimson';
}

export const CustomerSearchSelect: React.FC<CustomerSearchSelectProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  placeholder = 'Buscar cliente por nome...',
  required = false,
  className = '',
  accentColor = 'emerald',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontra o cliente atualmente selecionado
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Filtra clientes pelo termo digitado (apenas nome)
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [...customers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return customers
      .filter((c) => c.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [customers, searchTerm]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCustomer('');
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const borderFocusClasses = {
    emerald: 'focus-within:border-emerald-500',
    amber: 'focus-within:border-amber-500',
    crimson: 'focus-within:border-crimson-500',
  }[accentColor];

  const activeOptionBg = {
    emerald: 'bg-emerald-950/60 text-emerald-300 font-bold',
    amber: 'bg-amber-950/60 text-amber-300 font-bold',
    crimson: 'bg-crimson-950/60 text-crimson-300 font-bold',
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input principal de busca / exibição */}
      <div
        className={`relative flex items-center w-full h-10 px-3 rounded-xl bg-trigon-900 border border-trigon-750 transition-colors ${borderFocusClasses}`}
      >
        <Search className="w-3.5 h-3.5 text-trigon-500 shrink-0 mr-2" />

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedCustomer?.name || ''}
          placeholder={selectedCustomer ? selectedCustomer.name : placeholder}
          onFocus={handleInputFocus}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className="w-full bg-transparent text-white text-xs placeholder-trigon-500 focus:outline-none font-medium truncate"
        />

        {/* Input oculto para validação HTML required se necessário */}
        {required && (
          <input
            type="text"
            tabIndex={-1}
            value={selectedCustomerId}
            onChange={() => {}}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            required
          />
        )}

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selectedCustomerId && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-trigon-400 hover:text-white hover:bg-trigon-800 transition-colors"
              title="Limpar cliente selecionado"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-trigon-500 hover:text-trigon-300"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown com a lista de clientes (exibindo apenas o nome) */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-trigon-900 border border-trigon-750 shadow-2xl py-1 divide-y divide-trigon-800/60 animate-in fade-in-50 duration-100">
          {filteredCustomers.length === 0 ? (
            <div className="px-3.5 py-3 text-center text-xs text-trigon-500 italic">
              Nenhum cliente encontrado com &quot;{searchTerm}&quot;
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = c.id === selectedCustomerId;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`px-3.5 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? activeOptionBg
                      : 'text-trigon-200 hover:bg-trigon-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="w-3.5 h-3.5 text-trigon-500 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

