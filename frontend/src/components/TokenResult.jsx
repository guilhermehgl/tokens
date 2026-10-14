import { useRef, useState } from 'react';
import { Dialog, Button } from './AdminUI';
import { copyText } from '../utils/clipboard';

export default function TokenResult({ token, onClose, returnFocusRef }) {
  const [feedback, setFeedback] = useState('');
  const codeRef = useRef(null);
  async function copy() {
    const copied = await copyText(token, codeRef.current.parentElement);
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setFeedback(copied ? 'Token copiado!' : 'O navegador bloqueou a cópia. O código está selecionado: pressione Ctrl+C ou use a opção Copiar do dispositivo.');
  }
  return <Dialog title="Token gerado com sucesso" onClose={onClose} returnFocusRef={returnFocusRef}>
    <p>Código de verificação</p>
    <output ref={codeRef} className="token-result-code" aria-label="Código de verificação">{token}</output>
    <p>Nenhuma mensagem foi enviada por e-mail ou WhatsApp.</p>
    <p>Copie o código, saia deste perfil e entre como verificador para validar a retirada. O código é exibido apenas agora.</p>
    <p role="status">{feedback}</p>
    <div className="admin-modal-actions"><Button onClick={copy}>Copiar token</Button><Button variant="primary" onClick={onClose}>Concluir</Button></div>
  </Dialog>;
}
