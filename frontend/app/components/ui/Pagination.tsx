import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Button from './Button';

interface Props {
    page: number;
    limit: number;
    total: number;
    onPage: (page: number) => void;
}

export default function Pagination({ page, limit, total, onPage }: Props) {
    if (total === 0) return null;
    const desde = (page - 1) * limit + 1;
    const hasta = Math.min(page * limit, total);
    const ultima = Math.ceil(total / limit);
    return (
        <div className="pager">
            <span>
                {desde}–{hasta} de {total.toLocaleString('es-PE')}
            </span>
            <div className="pager__btns">
                <Button pequeno disabled={page <= 1} onClick={() => onPage(page - 1)} icono={<FaChevronLeft style={{ fontSize: 10 }} />}>
                    Anterior
                </Button>
                <Button pequeno disabled={page >= ultima} onClick={() => onPage(page + 1)}>
                    Siguiente <FaChevronRight style={{ fontSize: 10 }} />
                </Button>
            </div>
        </div>
    );
}