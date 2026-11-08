/** Validate server configuration without exposing credentials or provider internals. */
export function requireGameBackend(url: string | undefined, serverKey: string | undefined) {
  if (!url?.trim() || !serverKey?.trim()) {
    throw new Error('Koneksi penyimpanan permainan belum dikonfigurasi di hosting ini. Pengelola perlu memasang koneksi server lalu menerbitkan ulang aplikasi.');
  }
}
/** Translate a storage error into a safe, actionable message for the host. */
export function storageErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string) {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || msg.includes('could not find the table') || msg.includes('does not exist')) {
    return 'Tabel permainan belum dibuat di penyimpanan. Jalankan file migrasi permainan sekali di database, lalu coba lagi.';
  }
  if (msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('unauthorized') || code === '401' || code === '42501' || msg.includes('permission denied')) {
    return 'Kunci server penyimpanan ditolak. Periksa bahwa kunci rahasia server (bukan kunci publik) yang dipasang di hosting, lalu deploy ulang.';
  }
  if (msg.includes('fetch failed') || msg.includes('enotfound') || msg.includes('network')) {
    return 'Alamat penyimpanan tidak dapat dihubungi. Periksa alamat URL penyimpanan di hosting, lalu deploy ulang.';
  }
  return fallback;
}
