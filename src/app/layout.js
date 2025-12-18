import '../styles/global.css';

export const metadata = {
  title: 'Bartender Stock App',
  description: 'Manage restaurant inventory',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}