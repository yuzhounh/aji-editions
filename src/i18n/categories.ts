
export type Locale = 'en' | 'zh';

const majorCategoryMap: Record<string, { en: string; zh: string }> = {
    "农林科学": { "en": "Agricultural and Forestry Sciences", "zh": "农林科学" },
    "地球科学": { "en": "Geosciences", "zh": "地球科学" },
    "工程技术": { "en": "Engineering and Technology", "zh": "工程技术" },
    "环境科学与生态学": { "en": "Environmental Science and Ecology", "zh": "环境科学与生态学" },
    "化学": { "en": "Chemistry", "zh": "化学" },
    "计算机科学": { "en": "Computer Science", "zh": "计算机科学" },
    "经济学": { "en": "Economics", "zh": "经济学" },
    "教育学": { "en": "Education", "zh": "教育学" },
    "法学": { "en": "Law", "zh": "法学" },
    "管理学": { "en": "Management", "zh": "管理学" },
    "材料科学": { "en": "Materials Science", "zh": "材料科学" },
    "数学": { "en": "Mathematics", "zh": "数学" },
    "医学": { "en": "Medicine", "zh": "医学" },
    "哲学": { "en": "Philosophy", "zh": "哲学" },
    "物理与天体物理": { "en": "Physics and Astrophysics", "zh": "物理与天体物理" },
    "心理学": { "en": "Psychology", "zh": "心理学" },
    "生物学": { "en": "Biology", "zh": "生物学" },
    "社会科学": { "en": "Social Sciences", "zh": "社会科学" },
    "艺术学": { "en": "Arts", "zh": "艺术学" },
    "人文学科": { "en": "Humanities", "zh": "人文学科" },
    "地球科学与环境生态": { "en": "Geosciences and Environmental Ecology", "zh": "地球科学与环境生态" },
    "交叉学科": { "en": "Interdisciplinary", "zh": "交叉学科" },
    "综合性期刊": { "en": "Comprehensive Journals", "zh": "综合性期刊" },
    "社会学": { "en": "Sociology", "zh": "社会学" },
    "文学": { "en": "Literature", "zh": "文学" },
    "历史学": { "en": "History", "zh": "历史学" }
};

function toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return '';
    }).join(' ');
}

function extractMinorCategoryParts(name: string): { en: string; zh: string } {
    if (!name) return { en: '', zh: '' };
    // Regex to find Chinese characters and the text that follows them.
    // This assumes the Chinese part comes second.
    const zhPartMatch = name.match(/[\u4e00-\u9fa5].*/);
    let zhPart = '';
    let enPart = name;

    if (zhPartMatch) {
        zhPart = zhPartMatch[0].trim();
        // The English part is everything before the Chinese part.
        enPart = name.substring(0, zhPartMatch.index).trim();
    }

    return {
        en: toTitleCase(enPart),
        zh: zhPart
    };
}

export function getMajorCategoryName(name: string, locale: Locale): string {
    if (majorCategoryMap[name]) {
        return majorCategoryMap[name][locale];
    }
    return name; // fallback
}

export function getMinorCategoryName(name: string, locale: Locale): string {
    const parts = extractMinorCategoryParts(name);
    return parts[locale] || name;
}
