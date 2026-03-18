import React from 'react';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../hooks/useTranslation';

interface ConflictModalProps {
    isOpen: boolean;
    onConfirm: (clearData: boolean) => void;
    onCancel: (clearData: boolean) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
    isOpen,
    onConfirm,
    onCancel
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isOpen}
            title={t('modal_conflict_title')}
            message={
                <span dangerouslySetInnerHTML={{ __html: t('modal_conflict_message') }} />
            }
            type="warning"
            confirmLabel={t('modal_conflict_action_clear')}
            cancelLabel={t('modal_conflict_action_keep')}
            showCancel={true}
            onConfirm={() => onConfirm(true)}
            onCancel={() => onCancel(false)}
        />
    );
};
