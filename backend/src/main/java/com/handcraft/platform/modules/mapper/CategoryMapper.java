package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.Category;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 品类先锁后检查，层级创建后固定。 */
@Mapper
public interface CategoryMapper {
    String COLUMNS="id,parent_id,name,enabled,sort_order";
    @Select("SELECT "+COLUMNS+" FROM category ORDER BY sort_order,id") List<Category> all();
    @Select("SELECT "+COLUMNS+" FROM category WHERE id=#{id}") Category find(Long id);
    @Select("SELECT "+COLUMNS+" FROM category WHERE id=#{id} FOR SHARE") Category share(Long id);
    @Select("SELECT "+COLUMNS+" FROM category WHERE id=#{id} FOR UPDATE") Category lock(Long id);
    /** 一级下存在任何二级时，发布必须选择二级。 */
    @Select("SELECT EXISTS (SELECT 1 FROM category WHERE parent_id=#{id})") boolean hasChildren(Long id);
    /** 一级自身为末级或其下仍有启用二级时，可以基于该一级分类发起新定制。 */
    @Select("""
        SELECT NOT EXISTS (SELECT 1 FROM category WHERE parent_id=#{id})
            OR EXISTS (SELECT 1 FROM category WHERE parent_id=#{id} AND enabled=1)
        """) boolean rootHasSelectableLeaf(Long id);
    @Insert("INSERT INTO category(parent_id,name,enabled,sort_order) VALUES(#{parentId},#{name},#{enabled},#{sortOrder})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Category value);
    @Update("UPDATE category SET name=#{name},enabled=#{enabled},sort_order=#{sortOrder} WHERE id=#{id}") int update(Category value);
}
