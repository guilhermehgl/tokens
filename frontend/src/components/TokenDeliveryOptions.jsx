import { formatPhoneDestination } from '../utils/phone';

export default function TokenDeliveryOptions({ company, channel, onChange, disabled }) {
  const telephone = formatPhoneDestination(company.telefone);
  return <fieldset className="token-delivery-options" disabled={disabled}>
    <legend>Enviar token por</legend>
    <label>
      <input type="radio" name={`delivery-${company._id}`} value="email" checked={channel === 'email'} onChange={() => onChange('email')} />
      <FiMail className="token-delivery-icon token-delivery-icon--email" size={24} aria-hidden="true" />
      <span><strong>E-mail</strong><small>Envia para: {company.emailReferencia}</small></span>
    </label>
    <label className={!telephone ? 'is-unavailable' : undefined}>
      <input type="radio" name={`delivery-${company._id}`} value="whatsapp" checked={channel === 'whatsapp'} disabled={!telephone || disabled} onChange={() => onChange('whatsapp')} />
      <FaWhatsapp className="token-delivery-icon token-delivery-icon--whatsapp" size={26} aria-hidden="true" />
      <span><strong>WhatsApp</strong><small>{telephone ? `Envia para: ${telephone}` : company.telefone ? 'Telefone cadastrado inválido.' : 'Empresa sem telefone cadastrado.'}</small></span>
    </label>
  </fieldset>;
}
import { FaWhatsapp } from 'react-icons/fa';
import { FiMail } from 'react-icons/fi';
