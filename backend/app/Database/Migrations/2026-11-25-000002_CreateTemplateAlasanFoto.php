<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Template alasan validasi foto (diterima / ditolak) yang dipilih fasil saat memvalidasi.
 * Daftarnya dikelola admin; diisi nilai bawaan saat migrasi.
 */
class CreateTemplateAlasanFoto extends Migration
{
    private const BAWAAN = [
        ['Diterima', 'Wajah terlihat jelas dan sesuai data penghuni.'],
        ['Diterima', 'Foto sesuai, lokasi dalam radius.'],
        ['Diterima', 'Wajah sedikit buram, namun masih dapat dikenali.'],
        ['Ditolak', 'Wajah tidak terlihat jelas / buram.'],
        ['Ditolak', 'Wajah tertutup (masker, helm, atau tangan).'],
        ['Ditolak', 'Foto terlalu gelap.'],
        ['Ditolak', 'Wajah tidak sesuai dengan penghuni terdaftar.'],
        ['Ditolak', 'Foto bukan diambil langsung (foto dari layar/kertas).'],
        ['Ditolak', 'Lebih dari satu orang di dalam foto.'],
    ];

    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'status'     => ['type' => 'ENUM', 'constraint' => ['Diterima', 'Ditolak']],
            'teks'       => ['type' => 'VARCHAR', 'constraint' => 200],
            'urutan'     => ['type' => 'INT', 'constraint' => 11, 'default' => 0],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['status', 'urutan']);
        $this->forge->createTable('template_alasan_foto', true);

        $now = date('Y-m-d H:i:s');
        $baris = [];
        foreach (self::BAWAAN as $i => [$status, $teks]) {
            $baris[] = ['status' => $status, 'teks' => $teks, 'urutan' => $i, 'created_at' => $now, 'updated_at' => $now];
        }
        $this->db->table('template_alasan_foto')->insertBatch($baris);
    }

    public function down()
    {
        $this->forge->dropTable('template_alasan_foto', true);
    }
}
