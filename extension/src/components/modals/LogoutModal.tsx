import React from 'react';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../hooks/useTranslation';

interface LogoutModalProps {
    isOpen: boolean;
    userEmail?: string;
    onConfirm: (clearData: boolean) => void;
    onCancel: (clearData: boolean) => void;
    onClose: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
    isOpen,
    userEmail,
    onConfirm,
    onCancel,
    onClose
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isOpen}
            title={t('modal_logout_title')}
            message={
                <span dangerouslySetInnerHTML={{ __html: t('modal_logout_message', { email: userEmail || '' }) }} />
            }
            type="info"
            confirmLabel={t('modal_logout_action_clear')}
            cancelLabel={t('modal_logout_action_keep')}
            showCancel={true}
            onConfirm={() => onConfirm(true)}
            onCancel={() => onCancel(false)}
            onClose={onClose}
        />
    );
};
