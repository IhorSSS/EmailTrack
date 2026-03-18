import React from 'react';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../hooks/useTranslation';

interface DeleteSingleEmailModalProps {
    isOpen: boolean;
    emailSubject?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const DeleteSingleEmailModal: React.FC<DeleteSingleEmailModalProps> = ({
    isOpen,
    emailSubject,
    onConfirm,
    onCancel
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isOpen}
            title={t('modal_delete_single_title')}
            message={
                <span dangerouslySetInnerHTML={{ __html: t('modal_delete_single_message', { subject: emailSubject || t('detail_no_subject') }) }} />
            }
            type="danger"
            confirmLabel={t('common_remove')}
            cancelLabel={t('common_cancel')}
            showCancel={true}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onClose={onCancel}
        />
    );
};
