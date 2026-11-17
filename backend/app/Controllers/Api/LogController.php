<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\LogAktivitas;
use CodeIgniter\API\ResponseTrait;

/**
 * Log aktivitas sistem (khusus admin, hanya baca). Log tidak dapat diubah/dihapus lewat API
 * agar tetap dapat dipercaya sebagai jejak audit.
 */
class LogController extends BaseController
{
    use ResponseTrait;

    // ----------------------------------------------------
    // GET /api/log?q=&entitas=&status=&dari=&sampai=&halaman=&per=
    // ----------------------------------------------------
    public function index()
    {
        if ((LogAktivitas::aktorDariToken($this->request)['role'] ?? '') !== 'admin') {
            return $this->failForbidden('Hanya admin yang dapat melihat log aktivitas.');
        }
        $db = \Config\Database::connect();
        if (! $db->tableExists('log_aktivitas')) {
            return $this->respond(['data' => [], 'total' => 0, 'halaman' => 1, 'per' => 25, 'pesan' => 'Tabel log belum dibuat. Jalankan: php spark migrate']);
        }

        $q       = trim((string) $this->request->getGet('q'));
        $entitas = trim((string) $this->request->getGet('entitas'));
        $status  = trim((string) $this->request->getGet('status'));
        $dari    = (string) $this->request->getGet('dari');
        $sampai  = (string) $this->request->getGet('sampai');
        $per     = max(10, min(100, (int) ($this->request->getGet('per') ?: 25)));
        $halaman = max(1, (int) ($this->request->getGet('halaman') ?: 1));
        $tanggalSah = static fn (string $t) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $t) === 1;

        $query = $db->table('log_aktivitas l')
            ->select("l.Id_log as id, DATE_FORMAT(l.Waktu, '%Y-%m-%d %H:%i:%s') as waktu, l.NIM as nim, u.Nama as nama, l.Peran as peran,
                l.Entitas as entitas, l.Aksi as aksi, l.Rute as rute, l.Target as target, l.Keterangan as keterangan,
                l.Status as status, l.Kode_http as kodeHttp, l.Data as data, l.Alamat_ip as ip, l.Agen as agen", false)
            ->join('user u', 'BINARY u.NIM = BINARY l.NIM', 'left', false);

        if ($entitas !== '') {
            $query->where('l.Entitas', $entitas);
        }
        if (in_array($status, ['berhasil', 'gagal'], true)) {
            $query->where('l.Status', $status);
        }
        if ($tanggalSah($dari)) {
            $query->where('l.Waktu >=', $dari . ' 00:00:00');
        }
        if ($tanggalSah($sampai)) {
            $query->where('l.Waktu <=', $sampai . ' 23:59:59');
        }
        if ($q !== '') {
            $query->groupStart()
                ->like('l.NIM', $q)->orLike('u.Nama', $q)->orLike('l.Aksi', $q)
                ->orLike('l.Target', $q)->orLike('l.Keterangan', $q)->orLike('l.Alamat_ip', $q)
                // Isi data yang dikirim (mis. alasan izin, nomor kamar); rahasia sudah disamarkan saat dicatat
                ->orLike('l.Data', $q)
                ->groupEnd();
        }

        $total = $query->countAllResults(false);
        $baris = $query->orderBy('l.Id_log', 'DESC')->limit($per, ($halaman - 1) * $per)->get()->getResultArray();
        foreach ($baris as &$b) {
            $b['id'] = (int) $b['id'];
            $b['kodeHttp'] = $b['kodeHttp'] === null ? null : (int) $b['kodeHttp'];
            $b['data'] = $b['data'] === null ? null : (json_decode($b['data'], true) ?? $b['data']);
        }

        unset($b);

        // Foto profil pelaku, dikirim sekali per NIM (bukan per baris) agar respons tetap ringan
        $foto = [];
        $nimHalaman = array_values(array_unique(array_filter(array_column($baris, 'nim'))));
        if ($nimHalaman !== [] && $db->fieldExists('Foto_profil', 'user')) {
            $rows = $db->table('user')->select('NIM, Foto_profil')->whereIn('NIM', $nimHalaman)
                ->where('Foto_profil IS NOT NULL', null, false)->where('Foto_profil !=', '')->get()->getResultArray();
            foreach ($rows as $r) {
                $foto[$r['NIM']] = $r['Foto_profil'];
            }
        }

        return $this->respond(['data' => $baris, 'total' => $total, 'halaman' => $halaman, 'per' => $per, 'foto' => (object) $foto]);
    }
}
