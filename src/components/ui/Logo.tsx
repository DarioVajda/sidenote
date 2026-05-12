interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { text: 'text-[13px] py-0.5', lp: 'pl-1' },
  md: { text: 'text-[15px] py-1',   lp: 'pl-1' },
  lg: { text: 'text-[26px] py-2', lp: 'pl-2' },
};

export default function Logo({ className = '', size = 'md' }: Props) {
  const { text, lp } = sizes[size];
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-tight leading-none overflow-hidden ${className}`}
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      <span className={`bg-black text-white ${text} ${lp} pr-0`}>Side</span>
      <span className={`bg-white text-black ${text} px-0`}>note</span>
    </span>
  );
}
