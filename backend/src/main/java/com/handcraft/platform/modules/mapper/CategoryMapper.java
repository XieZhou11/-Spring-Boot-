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
    @Insert("INSERT INTO category(parent_id,name,enabled,sort_order) VALUES(#{parentId},#{name},#{enabled},#{sortOrder})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Category value);
    @Update("UPDATE category SET name=#{name},enabled=#{enabled},sort_order=#{sortOrder} WHERE id=#{id}") int update(Category value);
}
