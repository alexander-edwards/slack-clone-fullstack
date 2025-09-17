import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

interface UserProfileModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onStartDM: (userId: number) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onStartDM,
}) => {
  if (!user) return null;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <img
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || user.username)}&background=random&size=200`}
                      alt={user.display_name}
                      className="w-32 h-32 rounded-full mx-auto mb-4"
                    />
                    
                    <h3 className="text-2xl font-bold text-gray-900">
                      {user.display_name}
                    </h3>
                    <p className="text-gray-500">@{user.username}</p>
                    
                    {user.status_text && (
                      <div className="mt-2 inline-flex items-center px-3 py-1 bg-gray-100 rounded-full">
                        {user.status_emoji && <span className="mr-2">{user.status_emoji}</span>}
                        <span className="text-sm">{user.status_text}</span>
                      </div>
                    )}
                    
                    <div className="mt-6">
                      <button
                        onClick={() => {
                          onStartDM(user.id);
                          onClose();
                        }}
                        className="inline-flex items-center px-4 py-2 bg-slack-green text-white rounded-md hover:bg-slack-greenHover"
                      >
                        <EnvelopeIcon className="w-5 h-5 mr-2" />
                        Send Direct Message
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default UserProfileModal;
