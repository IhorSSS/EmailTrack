import React from 'react';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { useTranslation } from '../../hooks/useTranslation';

interface DeleteHistoryModalProps {
    isOpen: boolean;
    senderFilter: string;
    uniqueSenders: string[];
    onConfirm: () => void;
    onCancel: () => void;
    onSenderChange: (sender: string) => void;
}

export const DeleteHistoryModal: React.FC<DeleteHistoryModalProps> = ({
    isOpen,
    senderFilter,
    uniqueSenders,
    onConfirm,
    onCancel,
    onSenderChange
}) => {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isOpen}
            title={t('modal_delete_title')}
            message={t('modal_delete_message')}
            type="danger"
            confirmLabel={t('modal_delete_action')}
            cancelLabel={t('common_cancel')}
            showCancel={true}
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <div className="et-modal-select-wrapper">
                <p className="et-modal-select-label">
                    {t('modal_delete_sender_select_label')}
                </p>
                <Select
                    value={senderFilter}
                    onChange={(e) => onSenderChange(e.target.value)}
                    options={[
                        { value: 'all', label: t('dashboard_filter_all_senders') },
                        ...uniqueSenders.map(s => ({ value: s, label: s }))
                    ]}
                />
            </div>
        </Modal>
    );
};
