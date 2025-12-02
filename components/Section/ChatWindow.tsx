
import React from 'react';
import { useParams } from 'react-router-dom';
import { DirectChat } from './Chat/DirectChat';

export const ChatWindow: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();

  if (friendId) {
      return <DirectChat friendId={friendId} />;
  }

  return null;
};
