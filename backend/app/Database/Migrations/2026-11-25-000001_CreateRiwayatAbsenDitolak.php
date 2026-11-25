<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Arsip percobaan absen yang fotonya ditolak fasil.
 * Saat penghuni absen ulang, baris presensi / presensi_event ditimpa; salinan
 * percobaan lama disimpan di sini agar tetap muncul di log riwayat presensi.
 */
class CreateRiwayatAbsenDitolak extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'               => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'jenis'            => ['type' => 'ENUM', 'constraint' => ['harian', 'event']],
            'nim'              => ['type' => 'VARCHAR', 'constraint' => 30],
            'tanggal'          => ['type' => 'DATE'],
            // Harian: nama sesi; event: id & judul event (judul disalin agar tetap terbaca bila event dihapus)
            'sesi'             => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'id_event'         => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            'judul_event'      => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'waktu'            => ['type' => 'TIME', 'null' => true],
            'latitude'         => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'longitude'        => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'foto'             => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'catatan_validasi' => ['type' => 'TEXT', 'null' => true],
            'divalidasi_oleh'  => ['type' => 'VARCHAR', 'constraint' => 30, 'null' => true],
            'divalidasi_pada'  => ['type' => 'DATETIME', 'null' => true],
            'created_at'       => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['nim', 'tanggal']);
        $this->forge->createTable('riwayat_absen_ditolak', true);
    }

    public function down()
    {
        $this->forge->dropTable('riwayat_absen_ditolak', true);
    }
}
