<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\API\ResponseTrait;

class DataController extends BaseController
{
    use ResponseTrait;

    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

    // ----------------------------------------------------
    // GET /api/gedung
    // ----------------------------------------------------
    public function getGedung()
    {
        $query = $this->db->query("
            SELECT 
                g.Id_Gedung as id,
                g.Nama as nama,
                g.NIM_Pj as nimPj,
                u.Nama as namaPj,
                g.Radius_meter as radiusMeter,
                (SELECT COUNT(*) FROM kamar k WHERE k.Id_Gedung = g.Id_Gedung) as totalKamar,
                CASE WHEN g.Nama LIKE '%Putri%' THEN 'Putri' ELSE 'Putra' END as jenis
            FROM gedung g
            LEFT JOIN user u ON u.NIM = g.NIM_Pj
            ORDER BY g.Id_Gedung ASC
        ");

        $data = $query->getResultArray();
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // GET /api/kamar
    // ----------------------------------------------------
    public function getKamar()
    {
        $query = $this->db->query("
            SELECT 
                k.Nomor_kamar as nomorKamar,
                k.Lantai as lantai,
                k.Id_Gedung as idGedung,
                g.Nama as namaGedung,
                (SELECT COUNT(*) FROM user u WHERE u.Nomor_kamar = k.Nomor_kamar) as penghuniCount
            FROM kamar k
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY k.Nomor_kamar ASC
        ");

        $data = $query->getResultArray();
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // GET /api/penghuni
    // ----------------------------------------------------
    public function getPenghuni()
    {
        $query = $this->db->query("
            SELECT 
                u.NIM as nim,
                u.Nama as nama,
                u.Nomor_kamar as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                u.Asal as asal,
                u.Email as email,
                u.No_HP as noHp,
                (u.Status_aktif = 'Aktif') as statusAktif,
                LOWER(u.Role) as role,
                '2023' as angkatan
            FROM user u
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY u.Nama ASC
        ");

        $data = $query->getResultArray();
        // Convert statusAktif to boolean and normalize roles
        foreach ($data as &$row) {
            $row['statusAktif'] = (bool)$row['statusAktif'];
            if ($row['role'] === 'mahasiswa') {
                $row['role'] = 'penghuni';
            }
        }
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/penghuni
    // ----------------------------------------------------
    public function addPenghuni()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = trim($input['nim'] ?? '');
        $nama = trim($input['nama'] ?? '');

        if (!$nim || !$nama) {
            return $this->fail('NIM dan Nama wajib diisi.', 400);
        }

        $exists = $this->db->table('user')->where('NIM', $nim)->countAllResults();
        if ($exists > 0) {
            return $this->fail('User dengan NIM tersebut sudah terdaftar.', 409);
        }

        $newUser = [
            'NIM'          => $nim,
            'Nama'         => $nama,
            'Nomor_kamar'  => $input['nomorKamar'] ?? null,
            'Asal'         => $input['asal'] ?? null,
            'No_HP'        => $input['noHp'] ?? null,
            'Email'        => $input['email'] ?? null,
            'Password'     => password_hash('penghuni123', PASSWORD_BCRYPT),
            'Role'         => 'Mahasiswa',
            'Status_aktif' => 'Aktif',
            'created_at'   => date('Y-m-d H:i:s'),
            'updated_at'   => date('Y-m-d H:i:s'),
        ];

        $this->db->table('user')->insert($newUser);
        return $this->respondCreated(['status' => 'success', 'message' => 'Penghuni berhasil ditambahkan']);
    }

    // ----------------------------------------------------
    // POST /api/penghuni/toggle-status
    // ----------------------------------------------------
    public function togglePenghuniStatus()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';

        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (!$user) {
            return $this->failNotFound('User tidak ditemukan.');
        }

        $newStatus = ($user['Status_aktif'] === 'Aktif') ? 'Nonaktif' : 'Aktif';
        $this->db->table('user')->where('NIM', $nim)->update([
            'Status_aktif' => $newStatus,
            'updated_at'   => date('Y-m-d H:i:s')
        ]);

        return $this->respond(['status' => 'success', 'newStatus' => $newStatus]);
    }

    // ----------------------------------------------------
    // GET /api/presensi
    // ----------------------------------------------------
    public function getPresensi()
    {
        $query = $this->db->query("
            SELECT 
                p.Id_presensi as id,
                p.NIM as nim,
                u.Nama as namaPenghuni,
                COALESCE(u.Nomor_kamar, '') as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                p.Tanggal as tanggal,
                p.Sesi as sesi,
                COALESCE(DATE_FORMAT(p.Waktu, '%H:%i'), '') as waktu,
                p.Status as status,
                COALESCE(p.Keterangan, '') as keterangan
            FROM presensi p
            LEFT JOIN user u ON u.NIM = p.NIM
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY p.Tanggal DESC, p.Id_presensi DESC
        ");

        $data = $query->getResultArray();
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/presensi
    // ----------------------------------------------------
    public function checkIn()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';
        $sesi = $input['sesi'] ?? 'Subuh';
        $tanggal = $input['tanggal'] ?? date('Y-m-d');
        $waktu = date('Y-m-d H:i:s');
        $status = $input['status'] ?? 'Hadir';
        $keterangan = $input['keterangan'] ?? 'Hadir via Web';

        if (!$nim) {
            return $this->fail('NIM wajib diisi.', 400);
        }

        // Check if already checked in today for this session
        $existing = $this->db->table('presensi')
            ->where('NIM', $nim)
            ->where('Tanggal', $tanggal)
            ->where('Sesi', $sesi)
            ->get()->getRowArray();

        if ($existing) {
            $this->db->table('presensi')
                ->where('Id_presensi', $existing['Id_presensi'])
                ->update([
                    'Waktu'      => $waktu,
                    'Status'     => $status,
                    'Keterangan' => $keterangan,
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        } else {
            $this->db->table('presensi')->insert([
                'NIM'        => $nim,
                'Tanggal'    => $tanggal,
                'Sesi'       => $sesi,
                'Waktu'      => $waktu,
                'Status'     => $status,
                'Keterangan' => $keterangan,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->respond(['status' => 'success', 'message' => 'Presensi berhasil dicatat']);
    }

    // ----------------------------------------------------
    // GET /api/izin
    // ----------------------------------------------------
    public function getIzin()
    {
        $query = $this->db->query("
            SELECT 
                i.Id_izin as id,
                i.NIM as nim,
                u.Nama as namaPenghuni,
                COALESCE(u.Nomor_kamar, '') as nomorKamar,
                COALESCE(g.Nama, '') as namaGedung,
                i.NIM_approver as nimApprover,
                approver.Nama as namaApprover,
                i.Alasan as alasan,
                i.Status_persetujuan as statusPersetujuan,
                COALESCE(i.File_bukti, '') as fileBukti,
                i.Tanggal as tanggal,
                i.Tanggal as tanggalAkhir,
                COALESCE(DATE_FORMAT(i.Tanggal_approval, '%Y-%m-%d'), '') as tanggalApproval
            FROM izin i
            LEFT JOIN user u ON u.NIM = i.NIM
            LEFT JOIN user approver ON approver.NIM = i.NIM_approver
            LEFT JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            LEFT JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            ORDER BY i.Tanggal DESC, i.Id_izin DESC
        ");

        $data = $query->getResultArray();
        return $this->respond($data);
    }

    // ----------------------------------------------------
    // POST /api/izin
    // ----------------------------------------------------
    public function addIzin()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = $input['nim'] ?? '';
        $alasan = $input['alasan'] ?? '';
        $tanggal = $input['tanggal'] ?? date('Y-m-d');
        $fileBukti = $input['fileBukti'] ?? '';

        if (!$nim || !$alasan) {
            return $this->fail('NIM dan Alasan izin wajib diisi.', 400);
        }

        $this->db->table('izin')->insert([
            'NIM'                => $nim,
            'Alasan'             => $alasan,
            'Status_persetujuan' => 'Pending',
            'File_bukti'         => $fileBukti,
            'Tanggal'            => $tanggal,
            'created_at'         => date('Y-m-d H:i:s'),
            'updated_at'         => date('Y-m-d H:i:s'),
        ]);

        return $this->respondCreated(['status' => 'success', 'message' => 'Pengajuan izin berhasil dikirim']);
    }

    // ----------------------------------------------------
    // POST /api/izin/status
    // ----------------------------------------------------
    public function updateIzinStatus()
    {
        $input = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = $input['id'] ?? 0;
        $status = $input['status'] ?? ''; // 'Disetujui' or 'Ditolak'
        $approverNim = $input['approverNim'] ?? '';

        if (!$id || !$status) {
            return $this->fail('ID izin dan status persetujuan wajib diisi.', 400);
        }

        $this->db->table('izin')->where('Id_izin', $id)->update([
            'Status_persetujuan' => $status,
            'NIM_approver'       => $approverNim,
            'Tanggal_approval'   => date('Y-m-d H:i:s'),
            'updated_at'         => date('Y-m-d H:i:s'),
        ]);

        return $this->respond(['status' => 'success', 'message' => 'Status izin berhasil diperbarui']);
    }
}
