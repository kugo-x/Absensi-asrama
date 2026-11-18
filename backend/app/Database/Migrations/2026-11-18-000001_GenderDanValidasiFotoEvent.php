<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * 1. Jenis gedung (Putra/Putri) disimpan sebagai kolom, bukan ditebak dari nama gedung.
 * 2. Jenis kelamin akun (L/P). Akun lama diisi otomatis dari gedung kamarnya, atau gedung yang ia pegang
 *    sebagai PJ; yang belum punya gedung dibiarkan NULL ("belum diisi") untuk dilengkapi admin.
 * 3. Validasi foto absen event oleh fasil (sama seperti presensi harian). Absen event lama yang
 *    sudah Hadir dengan foto dianggap sudah diterima.
 */
class GenderDanValidasiFotoEvent extends Migration
{
    public function up()
    {
        // ---- 1. Jenis gedung
        $this->forge->addColumn('gedung', [
            'Jenis' => ['type' => 'ENUM', 'constraint' => ['Putra', 'Putri'], 'default' => 'Putra', 'after' => 'Nama'],
        ]);
        $this->db->query("UPDATE gedung SET Jenis = IF(Nama LIKE '%Putri%', 'Putri', 'Putra')");

        // ---- 2. Jenis kelamin akun
        $this->forge->addColumn('user', [
            'Jenis_kelamin' => ['type' => 'ENUM', 'constraint' => ['L', 'P'], 'null' => true, 'after' => 'Nama'],
        ]);
        $this->db->query("
            UPDATE user u
            JOIN kamar k ON k.Nomor_kamar = u.Nomor_kamar
            JOIN gedung g ON g.Id_Gedung = k.Id_Gedung
            SET u.Jenis_kelamin = IF(g.Jenis = 'Putri', 'P', 'L')
        ");
        $this->db->query("
            UPDATE user u
            JOIN gedung g ON g.NIM_Pj = u.NIM
            SET u.Jenis_kelamin = IF(g.Jenis = 'Putri', 'P', 'L')
            WHERE u.Jenis_kelamin IS NULL
        ");

        // ---- 3. Validasi foto absen event
        if ($this->db->tableExists('presensi_event')) {
            $this->forge->addColumn('presensi_event', [
                'Status_foto'      => ['type' => 'ENUM', 'constraint' => ['Menunggu', 'Diterima', 'Ditolak'], 'null' => true],
                'Catatan_validasi' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'Divalidasi_oleh'  => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
                'Divalidasi_pada'  => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->db->query("UPDATE presensi_event SET Status_foto = 'Diterima' WHERE status = 'Hadir' AND foto IS NOT NULL AND foto <> ''");
        }
    }

    public function down()
    {
        if ($this->db->tableExists('presensi_event') && $this->db->fieldExists('Status_foto', 'presensi_event')) {
            $this->forge->dropColumn('presensi_event', ['Status_foto', 'Catatan_validasi', 'Divalidasi_oleh', 'Divalidasi_pada']);
        }
        $this->forge->dropColumn('user', 'Jenis_kelamin');
        $this->forge->dropColumn('gedung', 'Jenis');
    }
}
