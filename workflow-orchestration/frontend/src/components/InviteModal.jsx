import { useState } from 'react';
import toast from 'react-hot-toast';

const InviteModal = ({ isOpen, onClose, inviteData }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !inviteData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Invite Link Generated</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteData.inviteLink}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={() => copyToClipboard(inviteData.inviteLink)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <p>This link expires at:</p>
            <p className="font-medium">{new Date(inviteData.expiresAt).toLocaleString()}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            The invite link is valid for 30 minutes only.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
