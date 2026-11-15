<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * 1. Jadwal absen malam per hari (tabel `sesi_gedung_hari`).
 *    Baris di sini adalah PENGECUALIAN untuk satu hari dalam seminggu (1 = Senin … 7 = Minggu, ISO-8601).
 *    Hari tanpa baris memakai jam utama di `sesi_gedung`. Aktif = 0 berarti tidak ada absen malam hari itu.
 *
 * 2. Izin rutin berulang (kolom `izin.Hari_berulang`).
 *    Daftar hari ISO dipisah koma, mis. "2,4" = setiap Selasa & Kamis dalam rentang Tanggal–Tanggal_selesai.
 *    NULL = berlaku setiap hari dalam rentang (perilaku lama).
 */
class JadwalHariDanIzinBerulang extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_sesi_gedung_hari' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'Id_sesi_gedung'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true],
            'Hari'                => ['type' => 'TINYINT', 'constraint' => 1, 'unsigned' => true],
            'Jam_mulai'           => ['type' => 'TIME', 'null' => true],
            'Jam_selesai'         => ['type' => 'TIME', 'null' => true],
            'Aktif'               => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at'          => ['type' => 'DATETIME', 'null' => true],
            'updated_at'          => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('Id_sesi_gedung_hari', true);
        $this->forge->addUniqueKey(['Id_sesi_gedung', 'Hari'], 'uq_sesi_gedung_hari');
        $this->forge->addForeignKey('Id_sesi_gedung', 'sesi_gedung', 'Id_sesi_gedung', 'CASCADE', 'CASCADE', 'fk_sesi_gedung_hari_sesi');
        $this->forge->createTable('sesi_gedung_hari');

        $this->forge->addColumn('izin', [
            'Hari_berulang' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true, 'after' => 'Sesi'],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('izin', 'Hari_berulang');
        $this->forge->dropTable('sesi_gedung_hari', true);
    }
}
