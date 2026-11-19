import React, { useState } from 'react';
import {
  X, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, CreditCard, ArrowRightLeft
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function StatementImportModal({
  isOpen,
  onClose,
  accounts = [],
  onImported
}) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [items, setItems] = useState([]);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setItems([]);
    setError('');
    setTargetAccountId('');
    setSourceAccountId('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAnalyzeFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setPreview(null);
    setParsing(true);

    try {
      const fileBase64 = await fileToBase64(selectedFile);
      const res = await fetch(`${API}/api/finance/parse-statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mimeType: selectedFile.type || 'application/pdf',
          fileName: selectedFile.name
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo analizar el documento.');
      }

      setPreview(data);
      setItems(data.transactions || []);
      setTargetAccountId(data.matchedAccountId || accounts[0]?.id || '');

      const debitAcc = accounts.find(a => a.type === 'debito');
      if (debitAcc) setSourceAccountId(debitAcc.id);
    } catch (err) {
      setError(err.message || 'Error procesando el documento.');
    } finally {
      setParsing(false);
    }
  };

  const toggleItem = (idx) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  };

  const handleApply = async () => {
    if (!targetAccountId || applying) return;
    setApplying(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/finance/apply-statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAccountId,
          sourceAccountId: isPaymentReceipt ? sourceAccountId : null,
          documentType: preview?.documentType,
          statementInfo: preview?.statementInfo,
          transactions: items
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo aplicar la importación.');
      }
      if (onImported) onImported(data);
      handleClose();
    } catch (err) {
      setError(err.message || 'Error al guardar movimientos.');
    } finally {
      setApplying(false);
    }
  };

  const isPaymentReceipt =
    preview?.documentType === 'payment_receipt' ||
    items.some(t => t.selected && t.type === 'pago_tarjeta');
  const selectedCount = items.filter(t => t.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Estado de Cuenta / Comprobante</h2>
              <p className="text-xs text-slate-400">
                PDF, imagen o CSV de tarjeta de crédito o comprobante de pago (con anti-duplicados)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!preview && (
            <label className="block border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/50">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,.csv,.txt"
                className="hidden"
                onChange={(e) => handleAnalyzeFile(e.target.files?.[0])}
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">Analizando documento con IA...</p>
                  <p className="text-xs text-slate-400">{file?.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Upload className="w-8 h-8 text-indigo-400" />
                  <p className="text-sm font-semibold text-white">
                    Toca para subir tu Estado de Cuenta o Comprobante de Pago
                  </p>
                  <p className="text-xs text-slate-400">
                    Soporta PDF, captura de pantalla (PNG/JPG) o CSV bancario
                  </p>
                </div>
              )}
            </label>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {preview && (
            <>
              {/* Resumen detectado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 border border-white/10 rounded-2xl p-4">
                <div>
                  <span className="text-[11px] text-slate-400 block">Documento detectado</span>
                  <span className="text-sm font-bold text-white">
                    {preview.bank} {preview.cardLast4 ? `•••• ${preview.cardLast4}` : ''}
                  </span>
                  <span className="text-[11px] text-indigo-400 block mt-0.5">
                    {preview.documentType === 'payment_receipt'
                      ? 'Comprobante de Pago / Abono'
                      : 'Estado de Cuenta'}
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  {preview.statementInfo?.cutoffDate && (
                    <div>Corte: <strong className="text-white">{preview.statementInfo.cutoffDate}</strong></div>
                  )}
                  {preview.statementInfo?.dueDate && (
                    <div>Vencimiento: <strong className="text-white">{preview.statementInfo.dueDate}</strong></div>
                  )}
                  {preview.statementInfo?.cashPaymentCRC != null && (
                    <div>Contado CRC: <strong className="text-emerald-400">₡{Number(preview.statementInfo.cashPaymentCRC).toLocaleString()}</strong></div>
                  )}
                  {preview.statementInfo?.cashPaymentUSD != null && (
                    <div>Contado USD: <strong className="text-emerald-400">${Number(preview.statementInfo.cashPaymentUSD).toFixed(2)}</strong></div>
                  )}
                </div>
              </div>

              {/* Selectores de Cuenta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                    <span>Cuenta / Tarjeta destino</span>
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {isPaymentReceipt && (
                  <div>
                    <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pagado desde (opcional)</span>
                    </label>
                    <select
                      value={sourceAccountId}
                      onChange={(e) => setSourceAccountId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">Solo abonar a la tarjeta</option>
                      {accounts.filter(a => a.id !== targetAccountId).map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Lista de movimientos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Movimientos encontrados: <strong className="text-white">{items.length}</strong>
                    {preview.summary?.duplicatesSkipped > 0 && (
                      <span className="ml-2 text-amber-400">
                        ({preview.summary.duplicatesSkipped} ya estaban registrados)
                      </span>
                    )}
                  </span>
                  <span className="text-indigo-400 font-semibold">{selectedCount} seleccionados</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {items.map((item, idx) => (
                    <label
                      key={item.tempId || idx}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        item.selected
                          ? 'bg-indigo-500/10 border-indigo-500/35'
                          : 'bg-slate-950/60 border-white/5 opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={Boolean(item.selected)}
                          onChange={() => toggleItem(idx)}
                          className="rounded border-slate-600 text-indigo-500"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {item.merchant || item.description}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>{item.date}</span>
                            <span>• {item.category}</span>
                            {item.alreadyRecorded && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                                Ya registrado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-mono font-bold shrink-0 ${
                        item.type === 'ingreso' || item.type === 'pago_tarjeta'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}>
                        {item.type === 'ingreso' || item.type === 'pago_tarjeta' ? '+' : '-'}
                        {item.currency === 'USD' ? '$' : '₡'}
                        {Number(item.amount || 0).toLocaleString()}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 bg-slate-950/50">
          {preview ? (
            <button
              onClick={resetState}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cargar otro archivo
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            {preview && (
              <button
                onClick={handleApply}
                disabled={applying || selectedCount === 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{applying ? 'Importando...' : `Importar (${selectedCount})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
