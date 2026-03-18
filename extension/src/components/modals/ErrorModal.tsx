import React from 'react';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../hooks/useTranslation';

interface ErrorModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm
}) => {
    const t = useTranslation().t;

    return (
        <Modal
            isOpen={isOpen}
            title={title}
            message={message}
            type="danger"
            confirmLabel={t('common_close')}
            showCancel={false}
            onConfirm={onConfirm}
            onCancel={onConfirm}
        />
    );
};
