const importMap = {
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
    "react-router-dom": "https://esm.sh/react-router-dom@6.22.0",
    "framer-motion": "https://esm.sh/framer-motion@11.0.3",
    "@phosphor-icons/react": "https://esm.sh/@phosphor-icons/react@2.0.15",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.3",
    "clsx": "https://esm.sh/clsx@2.1.0",
    "tailwind-merge": "https://esm.sh/tailwind-merge@2.2.1",
    "date-fns": "https://esm.sh/date-fns@3.3.1"
  }
};
const im = document.createElement('script');
im.type = 'importmap';
im.textContent = JSON.stringify(importMap);
document.head.appendChild(im);