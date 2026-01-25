
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ChatCircleDots } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';

export const Nav: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  
  const isDetail = location.pathname.match(/^\/messages\/.+/) || location.pathname.match(/^\/post\/.+/) || location.pathname === '/login' || location.pathname === '/live';

  if (isDetail) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '32px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
    }}>
      <motion.nav 
        initial={{ y: 30, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={DS.Motion.Spring.Gentle}
        style={{
          background: DS.Color.Base.Glass,
          backdropFilter: DS.Effect.Blur.Glass,
          WebkitBackdropFilter: DS.Effect.Blur.Glass,
          borderRadius: DS.Radius.Full,
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          border: `1px solid ${DS.Color.Base.Border}`,
          boxShadow: DS.Effect.Shadow.Glass
        }}
      >
        <DockItem to="/" icon={House} active={isActive('/')} />
        <DockItem to="/messages" icon={ChatCircleDots} active={isActive('/messages')} />
      </motion.nav>
    </div>
  );
};

const DockItem = ({ to, icon: Icon, active }: { to: string, icon: any, active: boolean }) => {
  return (
    <Link to={to} style={{ position: 'relative', textDecoration: 'none' }}>
      <motion.div
        style={{
          position: 'relative',
          width: '56px',
          height: '48px',
          borderRadius: DS.Radius.Full,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? DS.Color.Base.Content[1] : DS.Color.Base.Content[3],
          background: active ? DS.Color.Base.Surface[3] : 'transparent',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Icon size={24} weight={active ? 'fill' : 'regular'} />
        {active && (
          <motion.div 
            layoutId="activeDot"
            style={{
              position: 'absolute',
              bottom: '6px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: DS.Color.Accent.Surface,
            }}
          />
        )}
      </motion.div>
    </Link>
  );
};
