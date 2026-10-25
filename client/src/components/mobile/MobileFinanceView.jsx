import React from 'react';
import FinanceView from '../FinanceView';

/**
 * MobileFinanceView
 * Redirige de forma transparente a FinanceView para garantizar paridad absoluta del 100%
 * entre versión móvil y de escritorio (mismas pestañas, mismas funciones, mismos balances).
 */
export default function MobileFinanceView(props) {
  return <FinanceView {...props} />;
}
