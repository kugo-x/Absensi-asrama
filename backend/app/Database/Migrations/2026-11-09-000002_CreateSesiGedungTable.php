<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Jadwal sesi per gedung (absen malam).
 *
 * Aturan: Admin mengatur sesi GLOBAL (tabel `sesi`, mis. Subuh) yang berlaku untuk semua gedung.
 * Absen malam berbeda tiap gedung, sehingga diatur fasil PJ masing-masing gedung di tabel ini.
 * Gedung yang belum diatur fasil TIDAK punya absen malam.
 */
class CreateSesiGedungTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'Id_sesi_gedung' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'Id_Gedung'      => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true],
            // Nama sesi seperti tersimpan di presensi.Sesi
            'Nama'           => ['type' => 'VARCHAR', 'constraint' => 50, 'default' => 'Malam'],
            'Jam_mulai'      => ['type' => 'TIME'],
            'Jam_selesai'    => ['type' => 'TIME'],
            'Aktif'          => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            // Fasil yang terakhir mengubah jadwal
            'Diatur_oleh'    => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('Id_sesi_gedung', true);
        $this->forge->addUniqueKey(['Id_Gedung', 'Nama'], 'uq_sesi_gedung_nama');
        $this->forge->addForeignKey('Id_Gedung', 'gedung', 'Id_Gedung', 'CASCADE', 'CASCADE', 'fk_sesi_gedung_gedung');
        $this->forge->addForeignKey('Diatur_oleh', 'user', 'NIM', 'CASCADE', 'SET NULL', 'fk_sesi_gedung_diatur_oleh');
        $this->forge->createTable('sesi_gedung');

        // Absen malam tidak lagi diatur admin secara global
        $this->db->table('sesi')->where('Nama', 'Malam')->delete();
    }

    public function down()
    {
        $this->forge->dropTable('sesi_gedung', true);

        // Kembalikan sesi Malam global bawaan bila belum ada
        if (! $this->db->table('sesi')->where('Nama', 'Malam')->countAllResults()) {
            $now = date('Y-m-d H:i:s');
            $this->db->table('sesi')->insert(['Nama' => 'Malam', 'Jam_mulai' => '18:00:00', 'Jam_selesai' => '20:30:00', 'Aktif' => 1, 'created_at' => $now, 'updated_at' => $now]);
        }
    }
}
