'use client';
import Button from './Button';
import Modal from '../Modal';

interface Props {
    abierto: boolean;
    titulo: string;
    texto: string;
    textoConfirmar: string;
    cargando?: boolean;
    onConfirmar: () => void;
    onCancelar: () => void;
}

export default function ConfirmarModal({
    abierto,
    titulo,
    texto,
    textoConfirmar,
    cargando,
    onConfirmar,
    onCancelar,
}: Props) {
    return (
        <Modal abierto={abierto} onCerrar={onCancelar} titulo={titulo}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>{texto}</p>
            <div className="form__actions" style={{ marginTop: 22 }}>
                <Button onClick={onCancelar}>Cancelar</Button>
                <Button variante="peligro" cargando={cargando} onClick={onConfirmar}>
                    {textoConfirmar}
                </Button>
            </div>
        </Modal>
    );
}