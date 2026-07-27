/**
 * db.js — 数据层
 * 基于 IndexedDB 封装，支持增删改查、备份导出、导入恢复
 */

const DB_NAME = 'InspirationWorkbench';
const DB_VERSION = 1;

// 数据表定义
const STORES = {
  materials: { keyPath: 'id', indexes: [
    { name: 'type', keyPath: 'type' },
    { name: 'collectionId', keyPath: 'collectionId' },
    { name: 'createdAt', keyPath: 'createdAt' },
    { name: 'tags', keyPath: 'tags', options: { multiEntry: true } }
  ]},
  collections: { keyPath: 'id', indexes: [
    { name: 'createdAt', keyPath: 'createdAt' }
  ]},
  notes: { keyPath: 'id', indexes: [
    { name: 'folderId', keyPath: 'folderId' },
    { name: 'type', keyPath: 'type' },
    { name: 'createdAt', keyPath: 'createdAt' }
  ]},
  folders: { keyPath: 'id', indexes: [
    { name: 'createdAt', keyPath: 'createdAt' }
  ]},
  books: { keyPath: 'id', indexes: [
    { name: 'category', keyPath: 'category' },
    { name: 'status', keyPath: 'status' },
    { name: 'createdAt', keyPath: 'createdAt' }
  ]},
  excerpts: { keyPath: 'id', indexes: [
    { name: 'bookId', keyPath: 'bookId' },
    { name: 'createdAt', keyPath: 'createdAt' }
  ]},
  todos: { keyPath: 'id', indexes: [
    { name: 'date', keyPath: 'date' },
    { name: 'done', keyPath: 'done' }
  ]},
  schedules: { keyPath: 'id', indexes: [
    { name: 'date', keyPath: 'date' }
  ]}
};

let db = null;

// 打开/初始化数据库
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      for (const [storeName, config] of Object.entries(STORES)) {
        if (!database.objectStoreNames.contains(storeName)) {
          const store = database.createObjectStore(storeName, { keyPath: config.keyPath });
          if (config.indexes) {
            config.indexes.forEach(idx => {
              store.createIndex(idx.name, idx.keyPath, idx.options || {});
            });
          }
        }
      }
    };
  });
}

// 通用：获取事务
function getTx(storeName, mode = 'readonly') {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// 生成唯一ID
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ===== 通用 CRUD =====
const DB = {
  async add(storeName, data) {
    if (!data.id) data.id = uid();
    if (!data.createdAt) data.createdAt = Date.now();
    return new Promise((resolve, reject) => {
      const store = getTx(storeName, 'readwrite');
      const req = store.add(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, data) {
    if (data.createdAt && !data.updatedAt) data.updatedAt = Date.now();
    return new Promise((resolve, reject) => {
      const store = getTx(storeName, 'readwrite');
      const req = store.put(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  // 按索引查询
  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  // 按游标范围查询（用于按时间排序）
  async getByRange(storeName, indexName, lower, upper) {
    return new Promise((resolve, reject) => {
      const store = getTx(storeName);
      const index = store.index(indexName);
      const range = (lower !== undefined && upper !== undefined)
        ? IDBKeyRange.bound(lower, upper)
        : (lower !== undefined ? IDBKeyRange.lowerBound(lower) : IDBKeyRange.upperBound(upper));
      const req = index.getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  uid,
  STORES,

  // ===== 备份导出 =====
  async exportAll() {
    const data = {};
    for (const storeName of Object.keys(STORES)) {
      data[storeName] = await this.getAll(storeName);
    }
    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      data
    };
  },

  // ===== 导入恢复 =====
  async importAll(backup) {
    if (!backup || !backup.data) throw new Error('备份文件格式错误');
    for (const storeName of Object.keys(STORES)) {
      await this.clear(storeName);
      const items = backup.data[storeName] || [];
      for (const item of items) {
        await this.add(storeName, item);
      }
    }
    return true;
  },

  // ===== 预置示例数据 =====
  async seedIfEmpty() {
    const count = await this.getAll('materials');
    if (count.length > 0) return false; // 已有数据，不注入

    const now = Date.now();
    const day = 86400000;

    // 合集
    const col1 = await this.add('collections', { name: '拍摄参考', icon: '📷' });
    const col2 = await this.add('collections', { name: 'BGM收藏', icon: '🎵' });
    const col3 = await this.add('collections', { name: '美妆灵感', icon: '💄' });

    // 素材
    const sampleMaterials = [
      { type: 'bgm', title: '复古爵士BGM｜适合慢节奏Vlog', note: '节奏舒缓，副歌在第45秒，可卡点转场。咖啡馆探店可用。', tags: ['BGM','复古'], collectionId: col2.id, sourceUrl: 'https://music.163.com/song?id=example', sourcePlatform: '网易云', cover: '🎵', createdAt: now - 3600000 },
      { type: 'image', title: '法式穿搭参考｜雾霾蓝配色方案', note: '配色与工作台风格一致，可做系列穿搭内容。', tags: ['穿搭','复古'], collectionId: col1.id, sourceUrl: 'https://www.xiaohongshu.com/explore/example', sourcePlatform: '小红书', cover: '👗', createdAt: now - 7200000 },
      { type: 'video', title: '变装卡点转场｜复古到现代', note: 'BGM节奏感强，跟拍门槛低，本周热度上升320%。', tags: ['转场','变装'], collectionId: col1.id, sourceUrl: 'https://www.douyin.com/video/example', sourcePlatform: '抖音', cover: '🎬', createdAt: now - 10800000 },
      { type: 'image', title: '蜜桃妆容参考｜粉紫色调', note: '粉紫配色，适合自拍跟拍，评论区互动率高。', tags: ['美妆','粉紫'], collectionId: col3.id, sourceUrl: 'https://www.xiaohongshu.com/explore/example2', sourcePlatform: '小红书', cover: '💄', createdAt: now - 14400000 },
      { type: 'link', title: '小红书探店笔记｜复古咖啡馆', note: '老城区咖啡馆，光线适合拍摄，下午3-5点最佳。', tags: ['探店','复古'], collectionId: col1.id, sourceUrl: 'https://www.xiaohongshu.com/explore/example3', sourcePlatform: '小红书', cover: '📷', createdAt: now - 18000000 },
      { type: 'image', title: '紫色系调色参考', note: '灰紫主色+雾蓝辅色，高光用奶油白。', tags: ['调色','粉紫'], collectionId: null, sourceUrl: '', sourcePlatform: '', cover: '✨', createdAt: now - 21600000 },
    ];
    for (const m of sampleMaterials) await this.add('materials', m);

    // 文件夹
    const f1 = await this.add('folders', { name: '创意灵感', icon: '💡' });
    const f2 = await this.add('folders', { name: '脚本草稿', icon: '🎬' });
    const f3 = await this.add('folders', { name: '复盘', icon: '🔄' });

    // 笔记
    const sampleNotes = [
      { type: 'short', folderId: f1.id, title: '粉色系调色思路', content: '蜜桃粉做主色调，灰紫做阴影，高光用奶油白。整体偏暖，适合人像特写。', tags: ['调色'], createdAt: now - 3600000 },
      { type: 'long', folderId: f2.id, title: '「夏日复古风」Vlog 脚本 v2', content: '开场：推门进入咖啡馆，BGM渐入。\n第一幕：点单特写，强调复古杯子。\n第二幕：靠窗座位，自然光人像。\n第三幕：咖啡拉花特写，配合卡点。\n结尾：推门离开，画面渐暗。', tags: ['Vlog','脚本'], createdAt: now - 86400000 },
      { type: 'short', folderId: f1.id, title: '转场灵感', content: '用咖啡杯做遮罩转场，杯沿划过镜头的瞬间切换场景，配合卡点BGM。', tags: ['转场'], createdAt: now - 172800000 },
      { type: 'long', folderId: f3.id, title: '本周内容复盘', content: '本周发了3条内容，穿搭那条数据最好。\n分析原因：配色符合平台审美趋势，发布时间选在晚8点流量高峰。\n下周计划：延续穿搭系列，尝试加入探店元素。', tags: ['复盘'], createdAt: now - 259200000 },
    ];
    for (const n of sampleNotes) await this.add('notes', n);

    // 书籍
    const sampleBooks = [
      { title: '百年孤独', author: '加西亚·马尔克斯', cover: '📕', category: '文学', status: 'reading', createdAt: now - 86400000 * 7 },
      { title: '原则', author: '瑞·达利欧', cover: '📗', category: '成长', status: 'done', createdAt: now - 86400000 * 14 },
      { title: '设计心理学', author: '唐纳德·诺曼', cover: '📘', category: '设计', status: 'reading', createdAt: now - 86400000 * 5 },
      { title: '小王子', author: '安托万·圣埃克苏佩里', cover: '📙', category: '文学', status: 'want', createdAt: now - 86400000 * 3 },
      { title: '人间失格', author: '太宰治', cover: '📕', category: '文学', status: 'done', createdAt: now - 86400000 * 20 },
      { title: '习惯的力量', author: '查尔斯·都希格', cover: '📗', category: '成长', status: 'reading', createdAt: now - 86400000 * 10 },
    ];
    for (const b of sampleBooks) await this.add('books', b);

    // 摘抄（本周8条，上周5条）
    const bookIds = (await this.getAll('books')).map(b => b.id);
    const excerpts = [
      { bookId: bookIds[0], content: '许多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起父亲带他去见识冰块的那个遥远的下午。', page: '第1章', createdAt: now - 3600000 },
      { bookId: bookIds[0], content: '生命中真正重要的不是你遭遇了什么，而是你记住了哪些事，又是如何铭记的。', page: '第3章', createdAt: now - 86400000 },
      { bookId: bookIds[1], content: '痛苦+反思=进步。面对现实时的痛苦，是改变的前提。', page: '第5章', createdAt: now - 86400000 * 2 },
      { bookId: bookIds[2], content: '好的设计是让用户感觉不到设计的存在。', page: '第2章', createdAt: now - 86400000 * 3 },
      { bookId: bookIds[0], content: '孤独是一个人的狂欢，狂欢是一群人的孤独。', page: '第7章', createdAt: now - 86400000 * 4 },
      { bookId: bookIds[1], content: '不要混淆目标和欲望。', page: '第6章', createdAt: now - 86400000 * 5 },
      { bookId: bookIds[2], content: '设计不是为了让你看起来聪明，而是为了让人用起来不觉得自己愚蠢。', page: '第4章', createdAt: now - 86400000 * 6 },
      { bookId: bookIds[0], content: '过去都是假的，回忆是一条没有归途的路。', page: '第10章', createdAt: now - 86400000 * 7 },
      // 上周的5条
      { bookId: bookIds[4], content: '生而为人，我很抱歉。', page: '第1章', createdAt: now - 86400000 * 9 },
      { bookId: bookIds[1], content: '原则是用来坚持的，不是用来妥协的。', page: '第8章', createdAt: now - 86400000 * 10 },
      { bookId: bookIds[3], content: '所有的大人都曾经是小孩，虽然只有少数人记得。', page: '第1章', createdAt: now - 86400000 * 11 },
      { bookId: bookIds[4], content: '胆小鬼连幸福都会害怕，碰到棉花都会受伤。', page: '第2章', createdAt: now - 86400000 * 12 },
      { bookId: bookIds[5], content: '改变可能很慢，但只要坚持，习惯就会成为自动行为。', page: '第3章', createdAt: now - 86400000 * 13 },
    ];
    for (const e of excerpts) await this.add('excerpts', e);

    // 待办
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const sampleTodos = [
      { text: '回复粉丝评论', date: today, time: '10:00', done: true, doneAt: now - 7200000, createdAt: now - 86400000 },
      { text: '整理昨日素材', date: today, time: '11:30', done: true, doneAt: now - 5400000, createdAt: now - 86400000 },
      { text: '浏览灵感推送', date: today, time: '14:00', done: true, doneAt: now - 3600000, createdAt: now - 86400000 },
      { text: '拍摄复古穿搭内容', date: today, time: '16:00', done: false, doneAt: null, createdAt: now - 86400000 },
      { text: '剪辑并发布Vlog', date: today, time: '20:00', done: false, doneAt: null, createdAt: now - 86400000 },
      { text: '选品会议', date: tomorrow, time: '10:00', done: false, doneAt: null, createdAt: now - 86400000 },
      { text: '本周复盘', date: tomorrow, time: '21:00', done: false, doneAt: null, createdAt: now - 86400000 },
    ];
    for (const t of sampleTodos) await this.add('todos', t);

    // 日程
    const sampleSchedules = [
      { title: '晨间规划', desc: '浏览今日灵感推送，规划拍摄内容', date: today, time: '09:00', color: 'lavender', createdAt: now - 86400000 },
      { title: '回复粉丝互动', desc: '评论区 + 私信', date: today, time: '10:00', color: 'peach', createdAt: now - 86400000 },
      { title: '午餐', desc: '', date: today, time: '12:00', color: 'blue', createdAt: now - 86400000 },
      { title: '拍摄复古穿搭内容', desc: '地点：老城区咖啡馆 · 已加入素材库参考', date: today, time: '16:00', color: 'peach', createdAt: now - 86400000 },
      { title: '剪辑 + 发布Vlog', desc: '', date: today, time: '20:00', color: 'lavender', createdAt: now - 86400000 },
      { title: '睡前复盘', desc: '记录今日灵感 + 阅读摘抄', date: today, time: '22:30', color: 'blue', createdAt: now - 86400000 },
    ];
    for (const s of sampleSchedules) await this.add('schedules', s);

    return true;
  }
};

// 暴露到全局
window.DB = DB;
