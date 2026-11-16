package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.CategoryDTO;
import com.handcraft.platform.modules.vo.CategoryVO;
import java.util.List;

/** 平台有效品类与管理员两级维护。 */
public interface CategoryService {
    /** 读取有效品类，管理员模式包含已停用项并重新验证资格。 */
    List<CategoryVO> list(Long userId,boolean admin);
    /** 创建一级或二级品类并记录操作历史。 */
    CategoryVO create(Long userId,CategoryDTO input);
    /** 修改名称、排序和启停，禁止调整已有层级。 */
    CategoryVO update(Long userId,Long id,CategoryDTO input);
}
